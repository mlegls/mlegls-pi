---
next: done
part-of: "[[projects/mlegls-pi/issues/agentic-setup-reorg]]"
---

`decide(state, questions) → {[q]: {choice, p, dist}}` in `lib/`, jev-backed, with two fallbacks selectable per call: a logprob-capable cheap model, and `ask` (bounce to the parent model as a tool result, or to the human as `needs-input`). thresholds live in the caller, never in the backend; calibration is the point. low confidence maps onto the existing `needs-input` tag: selective prediction with a reject option.

done: the function exists with a test against jev, the fallbacks work, and "[[projects/mlegls-pi/issues/dispatch-script]]" can call it. jev access is already granted.

holes:
- the ask fallback mid-script: does the script suspend across the parent's turn (the async wake/block primitive), or does it fail and re-run? decide with "[[projects/mlegls-pi/issues/supervision-join-script]]".
- how conversation tail is serialized as jev `state` for in-session calls; the same serialization serves "[[projects/mlegls-pi/issues/ingress-filter]]".

2026-09-18: implemented in `lib/decide.ts`. Jev accepts its native Noul/Choice/Score questions; outputs retain winning-option probability and distribution (plus the weighted score for Score). Callers select `jev`, `logprobs`, or `ask` per call; no backend confidence thresholds or suspension semantics.

Verification: live TypeSafe Jev request using `JEV_API_KEY` routed a duplicate-charge refund to billing with p=1. Temporary local HTTP fixture checks passed Cloudflare/direct request encoding, documented Jev response normalization, OpenAI-compatible token-logprob fallback, and pure ask marker (no network). No permanent test harness added. Cloudflare transport and logprobs were fixture-tested, not live-tested. Logprobs requires 2–20 options and rejects missing option probabilities rather than inventing zeroes; its distribution is conditional on the option labels, not Jev-calibrated.

Repository check: `bun test` — 130 pass, 2 skipped, 0 fail. `bunx tsc --noEmit` reports existing errors in exa tests, session/tmux, and system-prompt tests; none in `lib/decide.ts`.
- 2026-09-18: the ask fallback mid-script neither suspends nor re-runs; the script runs in a forked session and blocks on `needs-input`: "[[projects/mlegls-pi/issues/context-handoff]]".
