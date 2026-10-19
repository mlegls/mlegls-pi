---
stage: "ticket"
author: "session:thr_s276cmsmq4"
---
condense-reflections-to-their-render-share (0e505b2d) shipped the reflection backstop with `PRESERVATION_FLOOR` in `extensions/context/om/session-ledger/render-summary.ts`: five regexes over reflection text (role, preferences/permissions, must/never/rules, blocked/pending, decided/decision). Any match is protected, and the rest go newest-first. The maintainer wants no ad hoc string matching here: Jev is at least as good, and the cost is negligible because omission only fires at compaction when reflections exceed their render share.

Done:
- `PRESERVATION_FLOOR` and `preserveReflection` are deleted. When reflections exceed their render share, the compaction hook (already async) ranks them with Jev before calling the renderer, and the renderer takes the resulting order (or a priority set plus order) as input. Ask Jev for reflections that state the session's role, user preferences or standing permissions, constraints, open blockers, or decisions still in force (the condenser prompt's preservation floor), first. Rank the rest by relevance to the session's current work, using the newest observations as context.
- Jev is reached through TypeSafe or OpenRouter; both keys are in the maintainer's default environment (`OPENROUTER_API_KEY` is exported in sessions). Read the typesafe-ai skill and use a cheap default model. If no credential is available or Jev errors or times out (a few seconds), fall back to newest-first, and log it to the OM debug log. No regex fallback.
- Jev does not run when reflections fit.
- Tests: the renderer honours a supplied order. A scripted or fake Jev ranks the role and constraint reflections ahead of newer ordinary ones. The no-credential path falls back to newest-first. One live Jev call on a fixture pool keeps the role reflection; record its latency and cost in the evidence. `bun test extensions/context/om` and `bunx tsc --noEmit` pass.
