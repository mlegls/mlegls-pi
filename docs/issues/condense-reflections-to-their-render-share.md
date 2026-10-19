---
stage: "ticket"
author: "session:thr_s276cmsmq4"
---
The reflection condenser's trigger (`reflector.maxTokens` 60k / `targetTokens` 40k) is independent of the render budget that `renderSummaryWithBudget` gives reflections (summary budget minus the observations actually kept, at least half the summary). On a 1M-window session reflections get about 62k and the pool fits. On a 200k window they get about 12k, so newest-first selection silently omits most of a 40k pool. The maintainer's intent: condensation (merging into shorter reflections) keeps reflections under budget, and render-time omission is a rare backstop, ranked by relevance rather than recency.

Done:
- The condenser's max and target derive from the session's reflection render share: max = half the resolved summary budget (`resolveCompactionSummaryMaxTokens`), target about 75% of max. Explicit `reflector.maxTokens`/`targetTokens` still win. Remove the fixed 60k/40k defaults.
- When reflections still exceed their render share, the backstop ranks them, not by recency. Reflections that state the session's role, user preferences, standing permissions, constraints, or open blockers are always kept first. The rest are ranked by relevance to the session's current work with Jev (see the typesafe-ai skill), with newest-first as the fallback when Jev is unavailable or errors. Run Jev only when omission fires. Optional: if Jev adds more than about a second, or needs credentials compaction can't rely on, ship the always-keep set with newest-first and record why.
- Tests: on a small-window fixture with a reflection pool over its share, the condenser triggers and the rendered summary keeps the role reflection. The backstop keeps role/constraint reflections ahead of newer ordinary ones. `bun test extensions/context/om` and `bunx tsc --noEmit` pass.

Context: om-reflections-grow-without-a-budget (landed 9e28c775); condenser prompt in `extensions/context/om/agents/condenser/prompts.ts` already holds the preservation floor that the always-keep set should mirror.
