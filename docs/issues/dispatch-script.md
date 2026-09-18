---
tags: [task]
next: measure
parent: "[[projects/mlegls-pi/issues/agentic-setup-reorg]]"
---

dispatch steps 2–6 as one `decide` call over (ticket, map output): plan / implement here / do it / compile / orchestrate, plus executor class. low confidence → `needs-input`. keep "warm context worth more than handoff" out of jev; that is the parent's call. the fence rule for workers changes from context fraction to cumulative cache-read tokens (the audit's cost driver), with respawn-from-ticket as the default at the fence.

done: dispatch's prose reduced to what the script cannot decide; the script's choices logged so "[[projects/mlegls-pi/issues/orchestration-audits]]" can check them against outcomes.

## Implementation — 2026-09-18

	type DispatchInput = { ticket: string; context?: string }
	dispatch(input, threshold)
	cacheReadFence(tokensSoFar, budget) // continue | respawn

Implemented in `lib/dispatch.ts`. One Jev call, two choice questions. Accepted result is `{route, executor, p, dist: {route, executor}}`; `p` is the minimum of the two winning probabilities, not a joint probability. Below the caller's threshold returns the existing `needs-input` ask marker plus `decision` so rejected choices remain loggable. Equality accepts. The pure cumulative cache-read fence respawns at or above its caller-supplied budget; not wired to workers. The audit supplies no calibrated numerical budget.

CLI: `bun lib/dispatch.ts ticket.md threshold [map-or-autoread-file] >> decisions.jsonl`. JSON includes the choice distributions for outcome comparisons; persistence is caller-owned. No context-vs-handoff question.

## Historical baseline (before tuning)

Sourced `~/.config/secrets/api-keys.env` and ran the CLI once per archived ticket using live Jev, threshold 0.60, no extra context. Entire archived ticket text was supplied unchanged. The two requested archive directories contain only four closed tickets (including session-instrumentation in the canonical checkout); `git log --all` also exposes only these four paths. The requested ~15-ticket sample is therefore unavailable, not silently substituted with synthetic tickets.

| Archived ticket | Route | Executor | p (min) | Route p | Executor p |
|---|---|---|---:|---:|---:|
| mlegls-pi/decide-primitive.md | orchestrate | research | 0.36 | 0.96 | 0.36 |
| mlegls-pi/session-instrumentation.md | compile | verify | 0.34 | 0.34 | 0.39 |
| system-config/project-docs-concepts.md | implement-here | prune | 0.48 | 0.48 | 0.92 |
| system-config/tracker-vault-adapter.md | compile | verify | 0.42 | 0.43 | 0.42 |

All four returned `needs-input` at 0.60. This is an eyeball baseline, not measured agreement: there are no historical route/executor labels. The documentation rewrite → prune is plausible; implementation tickets → research/verify are suspect. Archived completion/evidence prose can leak into executor choice despite the instruction to ignore historical completion. No criteria tuning performed on this tiny contaminated corpus. A larger set of pre-completion snapshots is needed before calibration.

Verification: temporary in-memory fetch fixture exercised one request containing both questions, optional context, rejection and exact-threshold acceptance, retained rejected decision, and cache fence below/at/above budget. Full `bun test`: 130 pass, 2 skip, 0 fail (34.38s). `bunx tsc --noEmit` reports only existing exa/session/system-prompt errors; none in dispatch. No permanent tests added.

Remaining integration: reduce `~/.pi/agent/skills/dispatch/SKILL.md` steps 2–6 to the CLI invocation, threshold/needs-input handling, and caller logging. Keep parent-owned context/handoff judgment, checkpoint handling, and expand–contract prose. That file is outside this implementation branch; the system-config coordinator owns it. Obtain more historical tickets before claiming the requested ~15-ticket evaluation complete.

decisions:
- 2026-09-18: lib/dispatch.ts landed (one decide call, threshold → ask marker, cacheReadFence pure and unwired). on the four archived tickets every call rejected at .60 with p .34–.48 and routes that disagree with what happened; archived tickets carry completion prose, so that baseline is not a measurement. next is measure: the eval corpus is worker spawn prompts from the board log (pre-completion tickets, route and agent known from the spawn), ~120 of them. keep the questions untuned until that runs. the dispatch skill's prose is not reduced until the script agrees with history.
