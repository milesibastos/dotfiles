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
const READ_ONLY_TOOLS = "read,bash,grep,find,ls";
const MAX_CONTEXT_BYTES_PER_OUTPUT = 24 * 1024;

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
- Synthesizes consensus, disagreements, required-now fixes, optional work, and ignored feedback.
- Does not edit by default.
- If the exact word \`autofix\` is present, only after synthesis it asks the main agent to apply required-now fixes.

Options:
- \`rounds=N\` challenge rounds after the initial independent review. Default: 2. Max: 4.`;
}

function parseArgs(rawArgs: string): { target: string; autofix: boolean; rounds: number; help: boolean } {
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
		const roundsMatch = token.match(/^rounds=(\d+)$/i);
		if (roundsMatch) {
			rounds = Math.max(0, Math.min(4, Number(roundsMatch[1])));
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
	let truncated = text.slice(0, maxBytes);
	while (byteLength(truncated) > maxBytes) truncated = truncated.slice(0, -1);
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

async function runPiReviewer(cwd: string, modelEntry: ReviewModel, phase: string, prompt: string): Promise<RunResult> {
	let tmp: { dir: string; file: string } | null = null;
	let stdoutBuffer = "";
	let stderr = "";
	let lastAssistantText = "";
	let stopReason: string | undefined;
	let errorMessage: string | undefined;

	try {
		tmp = await writeTempPrompt(prompt);
		const args = [
			"--mode",
			"json",
			"-p",
			"--no-session",
			"--no-extensions",
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

			const processLine = (line: string) => {
				if (!line.trim()) return;
				let event: any;
				try {
					event = JSON.parse(line);
				} catch {
					return;
				}

				if (event.type === "message_end" && event.message?.role === "assistant") {
					const text = extractTextFromMessage(event.message);
					if (text) lastAssistantText = text;
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
				stderr += data.toString();
			});

			proc.on("close", (code) => {
				if (stdoutBuffer.trim()) processLine(stdoutBuffer);
				resolve(code ?? 0);
			});

			proc.on("error", (error) => {
				stderr += `\n${error instanceof Error ? error.message : String(error)}`;
				resolve(1);
			});
		});

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

function baseReviewInstructions(target: string): string {
	return `You are a fresh-context code reviewer in a multi-model review debate.

Review target/focus:
${target}

You MUST inspect the repository, relevant instructions, and target/diff directly from files and commands. Do not rely on the parent chat history.

Start by establishing the actual scope:
- Run pwd and git status/diff commands as needed.
- If this is an umbrella workspace with nested git repos, inspect the target repo directly.
- Read relevant AGENTS.md/CLAUDE.md instructions before judging conventions.

Tool/edit rules:
- You are read-only. Do not edit, write, format, stage, commit, or mutate files.
- Use only inspection commands and file reads.

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

function buildInitialPrompt(target: string, modelEntry: ReviewModel): string {
	return `${baseReviewInstructions(target)}

You are ${modelEntry.label} (${modelEntry.model}). Perform your independent first-pass review now.`;
}

function formatRoundContext(rounds: ReviewRound[]): string {
	return rounds
		.map((round) => {
			const body = round.results
				.map((result) => {
					const status = result.exitCode === 0 ? "completed" : `failed exit=${result.exitCode}`;
					return `## ${round.name} — ${result.label} (${result.model}, ${status})\n\n${truncateForPrompt(result.output)}`;
				})
				.join("\n\n---\n\n");
			return `# ${round.name}\n\n${body}`;
		})
		.join("\n\n====================\n\n");
}

function buildChallengePrompt(target: string, modelEntry: ReviewModel, roundNumber: number, priorRounds: ReviewRound[]): string {
	return `${baseReviewInstructions(target)}

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

function formatFailureSummary(rounds: ReviewRound[]): string {
	const failures = rounds.flatMap((round) =>
		round.results
			.filter((result) => result.exitCode !== 0 || result.errorMessage)
			.map((result) => `- ${round.name} / ${result.label} (${result.model}): exit=${result.exitCode}${result.errorMessage ? `, ${result.errorMessage}` : ""}${result.stderr ? `\n  stderr: ${truncateForPrompt(result.stderr, 2000)}` : ""}`),
	);
	return failures.length ? `\n\n## Reviewer execution warnings\n${failures.join("\n")}` : "";
}

function appendActionMenu(text: string): string {
	return `${text.trim()}

---

Reply with [1], [2], or further instructions:
[1] Apply only the fixes worth doing now.
[2] Apply the fixes worth doing now plus optional improvements.`;
}

async function runFullReviewDebate(ctx: any, target: string, roundsCount: number, autofix: boolean): Promise<{ finalText: string; rounds: ReviewRound[]; synthesis: RunResult }> {
	const rounds: ReviewRound[] = [];

	ctx.ui?.setStatus?.("full-review", "initial reviews…");
	const initialResults = await Promise.all(
		REVIEW_MODELS.map((modelEntry) => runPiReviewer(ctx.cwd, modelEntry, "initial review", buildInitialPrompt(target, modelEntry))),
	);
	rounds.push({ name: "Initial independent review", results: initialResults });

	for (let round = 1; round <= roundsCount; round++) {
		ctx.ui?.setStatus?.("full-review", `challenge round ${round}/${roundsCount}…`);
		const challengeResults = await Promise.all(
			REVIEW_MODELS.map((modelEntry) =>
				runPiReviewer(ctx.cwd, modelEntry, `challenge round ${round}`, buildChallengePrompt(target, modelEntry, round, rounds)),
			),
		);
		rounds.push({ name: `Challenge round ${round}`, results: challengeResults });
	}

	ctx.ui?.setStatus?.("full-review", "synthesizing…");
	const synthesis = await runPiReviewer(ctx.cwd, SYNTHESIS_MODEL, "synthesis", buildSynthesisPrompt(target, rounds, autofix));
	const warnings = formatFailureSummary(rounds);
	const finalText = `${synthesis.output.trim()}${warnings}`;
	return { finalText, rounds, synthesis };
}

export default function fullReviewDebateExtension(pi: any) {
	pi.registerCommand("full-review", {
		description: "Multi-model review debate with challenge rounds",
		handler: async (args: string, ctx: any) => {
			await ctx.waitForIdle?.();

			const parsed = parseArgs(args || "");
			if (parsed.help) {
				pi.sendMessage({
					customType: "full-review-debate",
					content: usage(),
					display: true,
				});
				return;
			}

			ctx.ui?.notify?.(
				`Starting full-review debate: ${parsed.target} (${parsed.rounds} challenge round${parsed.rounds === 1 ? "" : "s"})`,
				"info",
			);

			try {
				const { finalText, rounds, synthesis } = await runFullReviewDebate(ctx, parsed.target, parsed.rounds, parsed.autofix);
				const displayText = parsed.autofix ? finalText : appendActionMenu(finalText);

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

				if (parsed.autofix) {
					pi.sendUserMessage(`Autofix was requested for /full-review.

Apply only the synthesized fixes worth doing now from the review below. Do not apply optional/deferred improvements unless they are required to make a required-now fix safe. Run focused validation after editing and summarize changed files plus commands/results.

## Review synthesis

${finalText}`);
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
