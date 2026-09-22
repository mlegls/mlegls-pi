---
stage: done
assignee: agent
part-of: "[[projects/mlegls-pi/issues/agentic-setup-reorg]]"
---

## Disposition — 2026-09-22

The classifier implementation is delivered; its proposed integration is superseded by policy-driven route.prepare and the prepared dispatch boundary. [Routing encounter](../../research/session-routing-verification-2026-09-21.md); [current dispatch](../../dispatch.md). The historical four-case experiment was not calibration. Further calibration of this unused classifier is not retained as a completion obligation.

## Prior scope and evidence

Measure the experimental Jev work-shape classifier against pre-completion worker prompts before using it in introduce/advance. Parent-owned concurrency decomposition stays in `realize`; `dispatch` is only the launch boundary.

done: classifier decisions logged and compared with historical outcomes; confidence handling justified by that evidence.

## Implementation — 2026-09-18

	type DispatchInput = { ticket: string; context?: string }
	classify(input, threshold)
	cacheReadFence(tokensSoFar, budget) // continue | respawn

Implemented in `lib/classify.ts`. One Jev call, two choice questions. Accepted result is `{route, executor, p, dist: {route, executor}}`; `p` is the minimum of the two winning probabilities, not a joint probability. Below the caller's threshold returns the existing `needs-input` ask marker plus `decision` so rejected choices remain loggable. Equality accepts. The pure cumulative cache-read fence respawns at or above its caller-supplied budget; not wired to workers. The audit supplies no calibrated numerical budget.

CLI: `bun lib/classify.ts ticket.md threshold [map-or-autoread-file] >> decisions.jsonl`. JSON includes the choice distributions for outcome comparisons; persistence is caller-owned. No context-vs-handoff question.

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

Current integration boundary: `lib/classify.ts` is experimental and not called by `dispatch`. Its possible use in introduce/advance is separate from the parent-owned concurrency plan. Obtain more pre-completion prompts before treating the historical evaluation as complete.

decisions:
- 2026-09-18: lib/dispatch.ts landed (one decide call, threshold → ask marker, cacheReadFence pure and unwired). on the four archived tickets every call rejected at .60 with p .34–.48 and routes that disagree with what happened; archived tickets carry completion prose, so that baseline is not a measurement. next is measure: the eval corpus is worker spawn prompts from the board log (pre-completion tickets, route and agent known from the spawn), ~120 of them. keep the questions untuned until that runs. the dispatch skill's prose is not reduced until the script agrees with history.

- 2026-09-20: classifier moved to `lib/classify.ts` (`classify`); it remains experimental. `dispatch` now launches prepared ready waves through BB/workmux. Parent-owned concurrency planning lives in `realize`; classification calibration is not a prerequisite for launching work. See [[projects/mlegls-pi/issues/archive/dispatch-ready-waves]].

2026-09-22 boundary: current dispatch is Orca-backed. This remains evaluation of lib/classify.ts on pre-completion prompts, not replacement of current routing or a requirement to restore BB/workmux.
