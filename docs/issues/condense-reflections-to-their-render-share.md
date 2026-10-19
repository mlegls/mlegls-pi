---
stage: "done"
author: "session:thr_s276cmsmq4"
---
The reflection condenser's trigger (`reflector.maxTokens` 60k / `targetTokens` 40k) is independent of the render budget that `renderSummaryWithBudget` gives reflections (summary budget minus the observations actually kept, at least half the summary). On a 1M-window session reflections get about 62k and the pool fits. On a 200k window they get about 12k, so newest-first selection silently omits most of a 40k pool. The maintainer's intent: condensation (merging into shorter reflections) keeps reflections under budget, and render-time omission is a rare backstop, ranked by relevance rather than recency.

Done:
- The condenser's max and target derive from the session's reflection render share: max = half the resolved summary budget (`resolveCompactionSummaryMaxTokens`), target about 75% of max. Explicit `reflector.maxTokens`/`targetTokens` still win. Remove the fixed 60k/40k defaults.
- When reflections still exceed their render share, the backstop ranks them, not by recency. Reflections that state the session's role, user preferences, standing permissions, constraints, or open blockers are always kept first. The rest are ranked by relevance to the session's current work with Jev (see the typesafe-ai skill), with newest-first as the fallback when Jev is unavailable or errors. Run Jev only when omission fires. Optional: if Jev adds more than about a second, or needs credentials compaction can't rely on, ship the always-keep set with newest-first and record why.
- Tests: on a small-window fixture with a reflection pool over its share, the condenser triggers and the rendered summary keeps the role reflection. The backstop keeps role/constraint reflections ahead of newer ordinary ones. `bun test extensions/context/om` and `bunx tsc --noEmit` pass.

Context: om-reflections-grow-without-a-budget (landed 9e28c775); condenser prompt in `extensions/context/om/agents/condenser/prompts.ts` already holds the preservation floor that the always-keep set should mirror.

## Result

done

```yaml
commit: 090876e2
stories:
  - story: Small-window condensation and explicit overrides
    outcome: held
  - story: Role/constraint preservation during omission
    outcome: held
  - story: Large-window pool fits without condensation
    outcome: held
evidence:
  path: docs/attachments/condense-reflections-to-their-render-share/index.md
  visual: false
  shots: []
tests:
  - extensions/context/om/session-ledger/render-summary.test.ts
filed: []
redrive: false
caveats:
  - "Repair: the lexical preservation floor in session-ledger/render-summary.ts was too broad. Words like should, only, requires, allows and because matched most ordinary reflections, so the backstop would have kept nearly everything as protected. I narrowed it to role, preferences/permissions, constraints/rules, blockers and decisions."
  - "I added render-summary.test.ts. The ticket's Done list asks for tests, but the implementer added none. It covers the budget derivation, explicit overrides winning independently, and the backstop keeping role and constraint reflections ahead of newer ordinary ones. It does not run the condenser trigger itself. That is covered only by the first-use script, which I re-ran at 200k (condenses 122 to 3 reflections) and 1M (no condensation). It still passes."
  - "Jev is skipped. It needs separate classifier credentials, and the renderer is synchronous. The ticket allows this fallback: preservation floor, then newest-first. The floor is lexical, so it can still miss a differently worded role or constraint, and records too large to fit can still be omitted. The condenser prompt, not this recognizer, remains the main protection."
  - "No cost trade-off in the diff. Condensation now fires earlier on small windows (about 12.5k on 200k instead of 60k), so more condenser worker calls there. I did not measure this."
  - "`bun test extensions/context/om` (6 pass) and `bunx tsc --noEmit` pass. `mise run test:affected` does not exist in this project."
```

Evidence: [docs/attachments/condense-reflections-to-their-render-share/index.md](docs/attachments/condense-reflections-to-their-render-share/index.md)
