/**
 * Full Review Debate
 *
 * Extension-backed `/full-review` command.
 *
 * Runs three fresh-context, read-only Pi subprocess reviewers in parallel, then
 * runs one or more challenge rounds where each reviewer sees and disputes the
 * other reviewers' findings, then synthesizes the debate into the familiar
 * full-review output format.
 *
 * The old prompt template at ~/.pi/agent/prompts/full-review.md can stay as
 * a reference/fallback. Extension commands are checked before prompt templates,
 * so this command shadows that template when the extension is loaded.
 */

import { spawn } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

const REVIEW_MODELS = [
	{ label: "GPT 5.5", model: "openai-codex/gpt-5.5" },
	{ label: "GLM 5.2", model: "opencode-go/glm-5.2" },
	{ label: "Kimi K2.7 Code", model: "opencode-go/kimi-k2.7-code" },
] as const;

const SYNTHESIS_MODEL = REVIEW_MODELS[0];
const READ_ONLY_TOOLS = "read,grep,find,ls";
const MAX_CONTEXT_BYTES_PER_OUTPUT = 24 * 1024;
const MAX_INSPECTION_CONTEXT_BYTES = 64 * 1024;
const REVIEWER_TIMEOUT_MS = 20 * 60 * 1000;

type ReviewModel = (typeof REVIEW_MODELS)[number];

type RunResult = {
	phase: string;
	label: string;
	model: string;
	exitCode: number;
	output: string;
	stderr: string;
	stopReason?: string;
	errorMessage?: string;
};

type ReviewRound = {
	name: string;
	results: RunResult[];
};

type LiveEvent = {
	type: "start" | "line" | "done";
	phase: string;
	label: string;
	model: string;
	text?: string;
	status?: "done" | "failed" | "aborted";
};

type LiveReporter = (event: LiveEvent) => void;

type LiveTaskState = {
	phase: string;
	label: string;
	model: string;
	status: "running" | "done" | "failed" | "aborted";
	lines: string[];
};

function usage(): string {
	return `# /full-review

Usage:
- /full-review
- /full-review code/evawoot-app/src
- /full-review rounds=1 code/chatwoot-operator
- /full-review autofix

Behavior:
- Runs fresh-context, read-only reviewers in parallel with exactly these models:
  - openai-codex/gpt-5.5
  - opencode-go/glm-5.2
  - opencode-go/kimi-k2.7-code
- Runs challenge rounds where reviewers inspect each other's claims and dispute weak findings.
- Streams reviewer tool calls and assistant progress live in the TUI while the debate runs.
- Synthesizes consensus, disagreements, required-now fixes, optional work, and ignored feedback.
- Does not edit by default.
- If the exact word \`autofix\` is present, only after synthesis it asks the main agent to apply required-now fixes.

Options:
- \`rounds=N\` challenge rounds after the initial independent review. Default: 2. Max: 4.`;
}

function parseArgs(rawArgs: string): { target: string; autofix: boolean; rounds: number; help: boolean; error?: string } {
	const tokens = rawArgs.trim().split(/\s+/).filter(Boolean);
	let autofix = false;
	let rounds = 2;
	const targetTokens: string[] = [];

	for (const token of tokens) {
		if (token === "help" || token === "--help" || token === "-h") {
			return { target: "", autofix: false, rounds: 2, help: true };
		}
		if (token === "autofix") {
			autofix = true;
			continue;
		}
		if (/^rounds=/i.test(token)) {
			const roundsMatch = token.match(/^rounds=(\d+)$/i);
			if (!roundsMatch) {
				return { target: "", autofix, rounds, help: false, error: `Invalid rounds option: ${token}. Use rounds=0..4.` };
			}
			rounds = Number(roundsMatch[1]);
			if (!Number.isInteger(rounds) || rounds < 0 || rounds > 4) {
				return { target: "", autofix, rounds: 2, help: false, error: `Invalid rounds value: ${roundsMatch[1]}. Use rounds=0..4.` };
			}
			continue;
		}
		targetTokens.push(token);
	}

	return {
		target: targetTokens.join(" ").trim() || "the current git diff",
		autofix,
		rounds,
		help: false,
	};
}

function byteLength(text: string): number {
	return Buffer.byteLength(text, "utf8");
}

function truncateForPrompt(text: string, maxBytes = MAX_CONTEXT_BYTES_PER_OUTPUT): string {
	if (byteLength(text) <= maxBytes) return text;
	let truncated = "";
	for (const char of text) {
		if (byteLength(truncated + char) > maxBytes) break;
		truncated += char;
	}
	return `${truncated}\n\n[Truncated ${byteLength(text) - byteLength(truncated)} bytes for the next debate prompt.]`;
}

function extractTextFromMessage(message: any): string {
	const parts = Array.isArray(message?.content) ? message.content : [];
	return parts
		.filter((part: any) => part?.type === "text" && typeof part.text === "string")
		.map((part: any) => part.text)
		.join("\n")
		.trim();
}

function summarizeForLive(text: string, maxLength = 220): string {
	const compact = text.replace(/\s+/g, " ").trim();
	if (!compact) return "";
	return compact.length > maxLength ? `${compact.slice(0, maxLength - 1)}…` : compact;
}

function stringifyToolArgs(args: any): string {
	if (!args || typeof args !== "object") return "";
	const safeArgs: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(args)) {
		if (typeof value === "string") safeArgs[key] = summarizeForLive(value, 90);
		else if (typeof value === "number" || typeof value === "boolean") safeArgs[key] = value;
		else if (Array.isArray(value)) safeArgs[key] = `[${value.length} item${value.length === 1 ? "" : "s"}]`;
		else if (value && typeof value === "object") safeArgs[key] = "{…}";
	}
	const serialized = JSON.stringify(safeArgs);
	return serialized === "{}" ? "" : ` ${summarizeForLive(serialized, 180)}`;
}

function getMessageLiveLines(message: any): string[] {
	const lines: string[] = [];
	const parts = Array.isArray(message?.content) ? message.content : [];
	for (const part of parts) {
		if (part?.type === "text" && typeof part.text === "string") {
			const summary = summarizeForLive(part.text);
			if (summary) lines.push(summary);
		}
	}
	return lines;
}

function charDisplayWidth(char: string): number {
	const codePoint = char.codePointAt(0) ?? 0;
	if (codePoint === 0) return 0;
	if ((codePoint >= 0x0300 && codePoint <= 0x036f) || (codePoint >= 0xfe00 && codePoint <= 0xfe0f)) return 0;
	if (
		(codePoint >= 0x1100 && codePoint <= 0x115f) ||
		(codePoint >= 0x2329 && codePoint <= 0x232a) ||
		(codePoint >= 0x2e80 && codePoint <= 0xa4cf) ||
		(codePoint >= 0xac00 && codePoint <= 0xd7a3) ||
		(codePoint >= 0xf900 && codePoint <= 0xfaff) ||
		(codePoint >= 0xfe10 && codePoint <= 0xfe19) ||
		(codePoint >= 0xfe30 && codePoint <= 0xfe6f) ||
		(codePoint >= 0xff00 && codePoint <= 0xff60) ||
		(codePoint >= 0xffe0 && codePoint <= 0xffe6) ||
		(codePoint >= 0x1f300 && codePoint <= 0x1faff)
	) {
		return 2;
	}
	return 1;
}

function displayWidth(text: string): number {
	let width = 0;
	for (const char of text) width += charDisplayWidth(char);
	return width;
}

function takeToWidth(text: string, width: number): string {
	let used = 0;
	let result = "";
	for (const char of text) {
		const next = used + charDisplayWidth(char);
		if (next > width) break;
		result += char;
		used = next;
	}
	return result;
}

function clipLine(line: string, width: number): string {
	if (width <= 0 || displayWidth(line) <= width) return line;
	if (width === 1) return "…";
	return `${takeToWidth(line, width - 1)}…`;
}

function renderLivePanel(
	tasks: Map<string, LiveTaskState>,
	target: string,
	roundsCount: number,
	statusText: string,
	width: number,
	theme: any,
): string[] {
	const fg = (name: string, text: string) => (typeof theme?.fg === "function" ? theme.fg(name, text) : text);
	const bold = (text: string) => (typeof theme?.bold === "function" ? theme.bold(text) : text);
	const maxWidth = Math.max(40, width || 120);
	const styled = (style: string, text: string) => fg(style, clipLine(text, maxWidth));
	const headerLines = [
		fg("toolTitle", bold(clipLine(`/full-review live debate — ${target}`, maxWidth))),
		styled("dim", `3 reviewers • ${roundsCount} challenge round${roundsCount === 1 ? "" : "s"} • ${statusText}`),
		styled("muted", "Press Esc/Ctrl-C to cancel."),
	];
	const bodyLines: string[] = [];

	for (const task of tasks.values()) {
		const icon = task.status === "running" ? "⏳" : task.status === "done" ? "✓" : task.status === "aborted" ? "◼" : "✗";
		const iconStyle = task.status === "running" ? "warning" : task.status === "done" ? "success" : task.status === "aborted" ? "warning" : "error";
		bodyLines.push("");
		bodyLines.push(fg(iconStyle, icon) + " " + fg("accent", clipLine(`${task.phase} ${task.label} (${task.model})`, maxWidth - 2)));
		const recent = task.lines.slice(-5);
		if (recent.length === 0) {
			bodyLines.push(styled("dim", "  waiting for events…"));
		} else {
			for (const line of recent) bodyLines.push(styled("toolOutput", `  ${line}`));
		}
	}

	if (tasks.size === 0) bodyLines.push("", styled("dim", "Starting reviewers…"));
	const bodyLimit = Math.max(0, 90 - headerLines.length);
	return [...headerLines, ...bodyLines.slice(-bodyLimit)];
}

function getPiInvocation(args: string[]): { command: string; args: string[] } {
	const currentScript = process.argv[1];
	const isBunVirtualScript = currentScript?.startsWith("/$bunfs/root/");
	if (currentScript && !isBunVirtualScript && fs.existsSync(currentScript)) {
		return { command: process.execPath, args: [currentScript, ...args] };
	}

	const execName = path.basename(process.execPath).toLowerCase();
	const isGenericRuntime = /^(node|bun)(\.exe)?$/.test(execName);
	if (!isGenericRuntime) {
		return { command: process.execPath, args };
	}

	return { command: "pi", args };
}

async function writeTempPrompt(prompt: string): Promise<{ dir: string; file: string }> {
	const dir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "pi-full-review-"));
	const file = path.join(dir, "prompt.md");
	await fs.promises.writeFile(file, prompt, { encoding: "utf8", mode: 0o600 });
	return { dir, file };
}

async function cleanupTempPrompt(tmp: { dir: string; file: string } | null): Promise<void> {
	if (!tmp) return;
	try {
		await fs.promises.unlink(tmp.file);
	} catch {
		// ignore
	}
	try {
		await fs.promises.rmdir(tmp.dir);
	} catch {
		// ignore
	}
}

async function runFixedCommand(cwd: string, command: string, args: string[], timeoutMs = 10_000): Promise<string> {
	return new Promise((resolve) => {
		let stdout = "";
		let stderr = "";
		let settled = false;
		const proc = spawn(command, args, { cwd, shell: false, stdio: ["ignore", "pipe", "pipe"] });
		const timer = setTimeout(() => {
			if (settled) return;
			proc.kill("SIGTERM");
		}, timeoutMs);
		timer.unref?.();
		proc.stdout.on("data", (data) => {
			stdout += data.toString();
		});
		proc.stderr.on("data", (data) => {
			stderr += data.toString();
		});
		proc.on("close", (code, signalCode) => {
			settled = true;
			clearTimeout(timer);
			const label = `$ ${command} ${args.join(" ")}`;
			if (code === 0) resolve(`${label}\n${stdout.trim() || "(no output)"}`);
			else resolve(`${label}\n[exit ${code ?? `signal ${signalCode ?? "unknown"}`}]\n${(stderr || stdout).trim() || "(no output)"}`);
		});
		proc.on("error", (error) => {
			settled = true;
			clearTimeout(timer);
			resolve(`$ ${command} ${args.join(" ")}\n[failed] ${error instanceof Error ? error.message : String(error)}`);
		});
	});
}

async function collectInspectionContext(cwd: string, target: string): Promise<string> {
	const sections = [`CWD: ${cwd}`, `Requested target/focus: ${target}`];
	sections.push(await runFixedCommand(cwd, "git", ["rev-parse", "--show-toplevel"]));
	sections.push(await runFixedCommand(cwd, "git", ["status", "--short"]));
	sections.push(await runFixedCommand(cwd, "git", ["diff", "--stat"]));
	sections.push(await runFixedCommand(cwd, "git", ["diff", "--cached", "--stat"]));

	if (target === "the current git diff" || /\bgit\s+diff\b/i.test(target)) {
		sections.push(await runFixedCommand(cwd, "git", ["diff", "--"], 20_000));
		sections.push(await runFixedCommand(cwd, "git", ["diff", "--cached", "--"], 20_000));
	}

	return truncateForPrompt(sections.join("\n\n---\n\n"), MAX_INSPECTION_CONTEXT_BYTES);
}

async function runPiReviewer(
	cwd: string,
	modelEntry: ReviewModel,
	phase: string,
	prompt: string,
	options: { signal?: AbortSignal; onLive?: LiveReporter } = {},
): Promise<RunResult> {
	let tmp: { dir: string; file: string } | null = null;
	let stdoutBuffer = "";
	let stderr = "";
	let lastAssistantText = "";
	let stopReason: string | undefined;
	let errorMessage: string | undefined;
	let wasAborted = false;
	let timedOut = false;
	let processSignal: string | null = null;

	const emit = (event: Omit<LiveEvent, "phase" | "label" | "model">) => {
		options.onLive?.({ phase, label: modelEntry.label, model: modelEntry.model, ...event });
	};

	try {
		emit({ type: "start" });
		tmp = await writeTempPrompt(prompt);
		const args = [
			"--mode",
			"json",
			"-p",
			"--no-session",
			"--no-extensions",
			"--no-skills",
			"--tools",
			READ_ONLY_TOOLS,
			"--model",
			modelEntry.model,
			`@${tmp.file}`,
		];
		const invocation = getPiInvocation(args);

		const exitCode = await new Promise<number>((resolve) => {
			const proc = spawn(invocation.command, invocation.args, {
				cwd,
				shell: false,
				stdio: ["ignore", "pipe", "pipe"],
			});
			const timeout = setTimeout(() => {
				timedOut = true;
				emit({ type: "line", text: `reviewer timed out after ${Math.round(REVIEWER_TIMEOUT_MS / 1000)}s; terminating…` });
				proc.kill("SIGTERM");
				setTimeout(() => {
					if (proc.exitCode === null && proc.signalCode === null) proc.kill("SIGKILL");
				}, 5000).unref?.();
			}, REVIEWER_TIMEOUT_MS);
			timeout.unref?.();

			const processLine = (line: string) => {
				if (!line.trim()) return;
				let event: any;
				try {
					event = JSON.parse(line);
				} catch {
					return;
				}

				if (event.type === "tool_execution_start" && event.toolName) {
					emit({ type: "line", text: `→ ${event.toolName}${stringifyToolArgs(event.args ?? event.input)}` });
				}

				if (event.type === "tool_execution_end" && event.toolName) {
					emit({ type: "line", text: `← ${event.toolName}${event.isError ? " failed" : " done"}` });
				}

				if (event.type === "message_end" && event.message?.role === "assistant") {
					const text = extractTextFromMessage(event.message);
					if (text) lastAssistantText = text;
					for (const liveLine of getMessageLiveLines(event.message)) emit({ type: "line", text: liveLine });
					if (event.message.stopReason) stopReason = event.message.stopReason;
					if (event.message.errorMessage) errorMessage = event.message.errorMessage;
				}

			};

			proc.stdout.on("data", (data) => {
				stdoutBuffer += data.toString();
				const lines = stdoutBuffer.split("\n");
				stdoutBuffer = lines.pop() || "";
				for (const line of lines) processLine(line);
			});

			proc.stderr.on("data", (data) => {
				const text = data.toString();
				stderr += text;
				const summary = summarizeForLive(text, 180);
				if (summary) emit({ type: "line", text: `stderr: ${summary}` });
			});

			proc.on("close", (code, signalCode) => {
				clearTimeout(timeout);
				processSignal = signalCode;
				if (stdoutBuffer.trim()) processLine(stdoutBuffer);
				resolve(code ?? (signalCode ? 128 : 0));
			});

			proc.on("error", (error) => {
				clearTimeout(timeout);
				stderr += `\n${error instanceof Error ? error.message : String(error)}`;
				resolve(1);
			});

			const abort = () => {
				wasAborted = true;
				emit({ type: "line", text: "aborting reviewer…" });
				proc.kill("SIGTERM");
				setTimeout(() => {
					if (proc.exitCode === null && proc.signalCode === null) proc.kill("SIGKILL");
				}, 5000).unref?.();
			};
			if (options.signal?.aborted) abort();
			else options.signal?.addEventListener("abort", abort, { once: true });
		});

		if (timedOut) {
			stopReason = "timeout";
			errorMessage = `Reviewer timed out after ${Math.round(REVIEWER_TIMEOUT_MS / 1000)}s`;
		} else if (wasAborted) {
			stopReason = "aborted";
			errorMessage = "Reviewer aborted";
		} else if (processSignal && exitCode !== 0) {
			stopReason = `signal:${processSignal}`;
			errorMessage = `Reviewer exited from signal ${processSignal}`;
		}
		const status = wasAborted ? "aborted" : exitCode === 0 && !errorMessage ? "done" : "failed";
		emit({ type: "done", status, text: status === "done" ? "completed" : errorMessage || `exit ${exitCode}` });

		return {
			phase,
			label: modelEntry.label,
			model: modelEntry.model,
			exitCode,
			output: lastAssistantText || errorMessage || stderr.trim() || "(no output)",
			stderr: stderr.trim(),
			stopReason,
			errorMessage,
		};
	} finally {
		await cleanupTempPrompt(tmp);
	}
}

function baseReviewInstructions(target: string, inspectionContext: string): string {
	return `You are a fresh-context code reviewer in a multi-model review debate.

Review target/focus:
${target}

You MUST inspect the repository, relevant instructions, and target/diff directly from files and commands. Do not rely on the parent chat history.

The parent extension has precomputed read-only git context below because reviewer subprocesses do not get shell access. Use it to understand the diff/status, then inspect relevant files directly with read/grep/find/ls.

## Precomputed read-only inspection context

${inspectionContext}

Scope rules:
- If this is an umbrella workspace with nested git repos, inspect the target repo/files directly with read/grep/find/ls.
- Read relevant AGENTS.md/CLAUDE.md instructions before judging conventions.

Tool/edit rules:
- You are read-only. Do not edit, write, format, stage, commit, or mutate files.
- You do not have bash access; use only read/grep/find/ls plus the precomputed git context above.

Review for:
- correctness, regressions, and edge cases
- tests and validation coverage
- security, privacy, auth, and data exposure risks
- maintainability, simplicity, coupling, and unnecessary complexity
- project-specific instructions and conventions
- docs/API/UX impact when relevant

Return concise, evidence-backed findings. Each finding should include:
- severity: blocker/high/medium/low
- file and line references when possible
- concrete evidence
- suggested fix
- required-now vs optional/deferred

Be complete: this is a full independent review, not a narrow angle split.`;
}

function buildInitialPrompt(target: string, modelEntry: ReviewModel, inspectionContext: string): string {
	return `${baseReviewInstructions(target, inspectionContext)}

You are ${modelEntry.label} (${modelEntry.model}). Perform your independent first-pass review now.`;
}

function formatRoundContext(rounds: ReviewRound[]): string {
	return rounds
		.map((round) => {
			const body = round.results
				.map((result) => {
					const status = result.exitCode === 0 && !result.errorMessage ? "completed" : `failed exit=${result.exitCode}${result.errorMessage ? `: ${result.errorMessage}` : ""}`;
					return `## ${round.name} — ${result.label} (${result.model}, ${status})\n\n${truncateForPrompt(result.output)}`;
				})
				.join("\n\n---\n\n");
			return `# ${round.name}\n\n${body}`;
		})
		.join("\n\n====================\n\n");
}

function buildChallengePrompt(target: string, modelEntry: ReviewModel, roundNumber: number, priorRounds: ReviewRound[], inspectionContext: string): string {
	return `${baseReviewInstructions(target, inspectionContext)}

You are ${modelEntry.label} (${modelEntry.model}) in challenge round ${roundNumber}.

Below are prior review/debate outputs from all models. Your job is to challenge them adversarially and constructively.

Required behavior:
1. Verify or falsify other reviewers' important claims using repo inspection where possible.
2. Challenge weak, speculative, duplicate, stale, or non-actionable findings.
3. Defend your own prior findings only if the evidence still holds; retract or downgrade them if not.
4. Add any newly discovered issues, especially blockers/high-severity issues missed by others.
5. Identify emerging consensus and remaining disagreements.
6. Keep output concise and evidence-backed.

Prior rounds:

${formatRoundContext(priorRounds)}

Return:
## Consensus so far
## Challenges / rebuttals
## Retractions or downgrades
## New or strengthened findings
## Final stance for this round`;
}

function buildSynthesisPrompt(target: string, rounds: ReviewRound[], autofix: boolean): string {
	return `You are the synthesizer for a multi-model code review debate.

Review target/focus:
${target}

Autofix requested: ${autofix ? "yes" : "no"}

You have outputs from three independent fresh-context reviewers and their challenge rounds. Synthesize them into one final, actionable review. Prefer evidence and consensus, but keep single-model findings if the evidence is strong.

Prior rounds:

${formatRoundContext(rounds)}

Output exactly these sections:
1. fixes worth doing now
2. findings agreed on by multiple models
3. model-specific findings worth considering
4. disagreements between models and your resolution
5. optional/deferred improvements
6. feedback to ignore, with a short reason

For every required-now finding, include severity, file/line when available, evidence, and suggested fix.
Do not propose edits directly. This is a review synthesis only.`;
}

function isResultFailure(result: RunResult): boolean {
	return result.exitCode !== 0 || result.stopReason === "error" || result.stopReason === "aborted" || result.stopReason === "timeout" || Boolean(result.errorMessage);
}

function hasRealOutput(result: RunResult): boolean {
	const output = result.output.trim();
	return output.length > 0 && output !== "(no output)" && output !== result.errorMessage;
}

function isSynthesisSuccessful(result: RunResult): boolean {
	return !isResultFailure(result) && hasRealOutput(result);
}

function formatResultDiagnostic(roundName: string, result: RunResult): string {
	return `- ${roundName} / ${result.label} (${result.model}): exit=${result.exitCode}${result.stopReason ? `, stop=${result.stopReason}` : ""}${result.errorMessage ? `, ${result.errorMessage}` : ""}${result.stderr ? `\n  stderr: ${truncateForPrompt(result.stderr, 2000)}` : ""}`;
}

function formatFailureSummary(rounds: ReviewRound[], extras: Array<{ roundName: string; result: RunResult }> = []): string {
	const failures = [
		...rounds.flatMap((round) => round.results.filter(isResultFailure).map((result) => formatResultDiagnostic(round.name, result))),
		...extras.filter(({ result }) => isResultFailure(result)).map(({ roundName, result }) => formatResultDiagnostic(roundName, result)),
	];
	return failures.length ? `\n\n## Reviewer execution warnings\n${failures.join("\n")}` : "";
}

function formatRoundDiagnostics(roundName: string, results: RunResult[]): string {
	return results.map((result) => formatResultDiagnostic(roundName, result)).join("\n");
}

function appendActionMenu(text: string): string {
	return `${text.trim()}

---

Reply with [1], [2], or further instructions:
[1] Apply only the fixes worth doing now.
[2] Apply the fixes worth doing now plus optional improvements.`;
}

async function runFullReviewDebate(
	ctx: any,
	target: string,
	roundsCount: number,
	autofix: boolean,
	onLive?: LiveReporter,
	signal?: AbortSignal,
): Promise<{ finalText: string; rounds: ReviewRound[]; synthesis: RunResult }> {
	const rounds: ReviewRound[] = [];
	const runnerOptions = { signal, onLive };
	const throwIfAborted = () => {
		if (signal?.aborted) throw new Error("Full-review debate canceled");
	};

	ctx.ui?.setStatus?.("full-review", "collecting inspection context…");
	const inspectionContext = await collectInspectionContext(ctx.cwd, target);
	throwIfAborted();

	ctx.ui?.setStatus?.("full-review", "initial reviews…");
	const initialResults = await Promise.all(
		REVIEW_MODELS.map((modelEntry) =>
			runPiReviewer(ctx.cwd, modelEntry, "initial review", buildInitialPrompt(target, modelEntry, inspectionContext), runnerOptions),
		),
	);
	throwIfAborted();
	rounds.push({ name: "Initial independent review", results: initialResults });
	if (initialResults.every(isResultFailure)) {
		throw new Error(`All initial reviewers failed; stopping before challenge rounds.\n${formatRoundDiagnostics("Initial independent review", initialResults)}`);
	}

	for (let round = 1; round <= roundsCount; round++) {
		ctx.ui?.setStatus?.("full-review", `challenge round ${round}/${roundsCount}…`);
		const challengeResults = await Promise.all(
			REVIEW_MODELS.map((modelEntry) =>
				runPiReviewer(
					ctx.cwd,
					modelEntry,
					`challenge round ${round}`,
					buildChallengePrompt(target, modelEntry, round, rounds, inspectionContext),
					runnerOptions,
				),
			),
		);
		throwIfAborted();
		rounds.push({ name: `Challenge round ${round}`, results: challengeResults });
		if (challengeResults.every(isResultFailure)) {
			throw new Error(`All reviewers failed in challenge round ${round}; stopping before synthesis.\n${formatRoundDiagnostics(`Challenge round ${round}`, challengeResults)}`);
		}
	}

	ctx.ui?.setStatus?.("full-review", "synthesizing…");
	const synthesis = await runPiReviewer(ctx.cwd, SYNTHESIS_MODEL, "synthesis", buildSynthesisPrompt(target, rounds, autofix), runnerOptions);
	throwIfAborted();
	const warnings = formatFailureSummary(rounds, [{ roundName: "Synthesis", result: synthesis }]);
	const finalText = isSynthesisSuccessful(synthesis)
		? `${synthesis.output.trim()}${warnings}`
		: `## Full-review synthesis failed\n\n${formatResultDiagnostic("Synthesis", synthesis)}${warnings}`;
	return { finalText, rounds, synthesis };
}

async function runFullReviewWithLivePanel(
	ctx: any,
	target: string,
	roundsCount: number,
	autofix: boolean,
): Promise<{ finalText: string; rounds: ReviewRound[]; synthesis: RunResult } | null> {
	if (ctx.mode !== "tui" || typeof ctx.ui?.custom !== "function") {
		return runFullReviewDebate(ctx, target, roundsCount, autofix);
	}

	return ctx.ui.custom((tui: any, theme: any, _keybindings: any, done: (value: any) => void) => {
		const controller = new AbortController();
		const tasks = new Map<string, LiveTaskState>();
		let statusText = "starting…";
		let settled = false;

		const requestRender = () => {
			try {
				tui.requestRender?.();
			} catch {
				// ignore render refresh failures
			}
		};

		const onLive: LiveReporter = (event) => {
			const key = `${event.phase}::${event.label}`;
			let task = tasks.get(key);
			if (!task) {
				task = { phase: event.phase, label: event.label, model: event.model, status: "running", lines: [] };
				tasks.set(key, task);
			}

			if (event.type === "start") {
				task.status = "running";
				statusText = event.phase;
			} else if (event.type === "line" && event.text) {
				task.lines.push(event.text);
				if (task.lines.length > 80) task.lines.splice(0, task.lines.length - 80);
			} else if (event.type === "done") {
				task.status = event.status === "aborted" ? "aborted" : event.status === "failed" ? "failed" : "done";
				if (event.text) task.lines.push(event.text);
			}
			requestRender();
		};

		runFullReviewDebate(ctx, target, roundsCount, autofix, onLive, controller.signal)
			.then((result) => {
				settled = true;
				done(result);
			})
			.catch((error) => {
				settled = true;
				if (controller.signal.aborted) done(null);
				else done({ __fullReviewError: error });
			});

		return {
			render(width: number) {
				return renderLivePanel(tasks, target, roundsCount, settled ? "finishing…" : statusText, width, theme);
			},
			invalidate() {
				requestRender();
			},
			handleInput(data: string) {
				if (data === "\u0003" || data === "\u001b" || data === "escape") {
					statusText = "canceling…";
					controller.abort();
					requestRender();
					return true;
				}
				return true;
			},
		};
	});
}

export default function fullReviewDebateExtension(pi: any) {
	pi.registerCommand("full-review", {
		description: "Multi-model review debate with challenge rounds",
		handler: async (args: string, ctx: any) => {
			await ctx.waitForIdle?.();

			const parsed = parseArgs(args || "");
			if (parsed.help || parsed.error) {
				pi.sendMessage({
					customType: "full-review-debate",
					content: parsed.error ? `${parsed.error}\n\n${usage()}` : usage(),
					display: true,
				});
				return;
			}

			ctx.ui?.notify?.(
				`Starting full-review debate: ${parsed.target} (${parsed.rounds} challenge round${parsed.rounds === 1 ? "" : "s"})`,
				"info",
			);

			try {
				const reviewResult: any = await runFullReviewWithLivePanel(ctx, parsed.target, parsed.rounds, parsed.autofix);
				if (!reviewResult) {
					ctx.ui?.notify?.("Full-review debate canceled", "info");
					return;
				}
				if (reviewResult.__fullReviewError) throw reviewResult.__fullReviewError;

				const { finalText, rounds, synthesis } = reviewResult;
				const synthesisOk = isSynthesisSuccessful(synthesis);
				const displayText = !synthesisOk || parsed.autofix ? finalText : appendActionMenu(finalText);

				pi.sendMessage({
					customType: "full-review-debate",
					content: displayText,
					display: true,
					details: {
						target: parsed.target,
						autofix: parsed.autofix,
						rounds: rounds.map((round) => ({
							name: round.name,
							results: round.results.map((result) => ({
								phase: result.phase,
								label: result.label,
								model: result.model,
								exitCode: result.exitCode,
								stopReason: result.stopReason,
								errorMessage: result.errorMessage,
							})),
						})),
						synthesis: {
							model: synthesis.model,
							exitCode: synthesis.exitCode,
							stopReason: synthesis.stopReason,
							errorMessage: synthesis.errorMessage,
						},
					},
				});

				if (parsed.autofix && synthesisOk) {
					pi.sendUserMessage(`Autofix was requested for /full-review.

Apply only the synthesized fixes worth doing now from the review below. Do not apply optional/deferred improvements unless they are required to make a required-now fix safe. Run focused validation after editing and summarize changed files plus commands/results.

## Review synthesis

${finalText}`);
				} else if (parsed.autofix && !synthesisOk) {
					ctx.ui?.notify?.("Autofix skipped because synthesis failed", "warning");
				}
			} catch (error) {
				const message = error instanceof Error ? error.stack || error.message : String(error);
				pi.sendMessage({
					customType: "full-review-debate",
					content: `Full-review debate failed:\n\n${message}`,
					display: true,
				});
			} finally {
				ctx.ui?.setStatus?.("full-review", undefined);
			}
		},
	});
}
