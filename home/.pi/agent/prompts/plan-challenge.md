---
description: Challenge a plan with GPT 5.5, GLM 5.2, and Kimi K2.7 Code
argument-hint: "<PLAN.md> [focus]"
---

Run a full multi-model plan challenge.

Plan file:
$1

Additional focus/instructions:
${@:2}

If no plan file was provided, ask for one before launching reviewers.

Model IDs to use exactly:
- `openai-codex/gpt-5.5`
- `opencode-go/glm-5.2`
- `opencode-go/kimi-k2.7-code`

Workflow:
- First, read the plan file and identify its stated goal, proposed approach, assumptions, target repos/files, validation strategy, rollout/ops impact, and open questions.
- If the plan references files, tickets, docs, repos, or commands, inspect enough of those local artifacts to judge the plan rather than reviewing it in isolation.
- Use fresh-context `reviewer` subagents, not forked context.
- Launch the three reviewers in parallel with the model override above.
- Each reviewer must independently perform a complete adversarial plan review; do not split by angle only.
- Reviewers must inspect the plan file and relevant repository context directly from files and commands.
- Reviewers must not edit project/source files or the plan file.

Ask every reviewer to challenge the plan on:
- correctness of the proposed approach
- missing requirements, hidden assumptions, and ambiguous scope
- architectural fit and project-specific constraints
- sequencing, migration, rollback, and operational risk
- security/privacy/auth/data exposure risks
- testability and validation strategy
- edge cases, failure modes, and production-readiness
- unnecessary complexity or simpler alternatives
- gaps that could cause implementation rework

Ask every reviewer to return concise, evidence-backed findings with:
- severity: blocker/high/medium/low
- plan section or file/line references when possible
- concrete evidence from the plan or repo
- recommended plan change
- whether the issue is required-now or optional/deferred

After reviewers return, synthesize the results into:
1. plan blockers or required changes before implementation
2. findings agreed on by multiple models
3. model-specific challenges worth considering
4. disagreements between models and your resolution
5. suggested revised plan outline or patch list
6. optional/deferred improvements
7. feedback to ignore, with a short reason

Do not edit files by default.

If the invocation includes the exact word `revise`, treat it as workflow control, remove it from reviewer scope, and after synthesis update only the plan file with the required changes worth doing now. Do not change source code. Summarize the plan edits afterward.
