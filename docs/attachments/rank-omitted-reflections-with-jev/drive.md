# Independent first-use drive

Revision: a957a5953ebb0ec7429a58d6bb1e80d9a9fb697c.

## Predictions before use

- Overflow: running the supplied compaction CLI with its 14-reflection seed will retain role/constraint reflections ahead of newer ordinary reflections and print observable retained output.
- Fit: a fitting reflection pool will not call the ranker.
- Offline/error: unavailable credentials or failed ranking will retain newest-first and emit a debug reason rather than fail compaction.
- Live: the supplied ranking CLI will use configured credentials, preserve the role reflection and report latency and cost.
- Supplied renderer order will be observable through the prepared library journey; source deletion and repository checks are reviewer-owned, not first-user observations.

## Setup

Local-library deployment in this checkout, not an inherited remote target. Persona: maintainer using committed CLI entry points. Seed/auth/entry commands supplied by implementer: 14 reflections plus current-work observation, offline no auth, live configured environment credentials. No services or destructive remote seeding required. Readiness established by both entry commands exiting 0. No source, fixture, or test inspection performed.

## Encounter and outcomes

1. Ran `bun docs/attachments/rank-omitted-reflections-with-jev/try-compaction.ts` from this checkout. Output confirmed overflow retained ranked role, with all 14 reflections retained in details. Fit scenario printed no credential lookup or Jev call. Missing credential and error scenarios printed newest-first in 0 ms each; timeout printed newest-first in 4,003 ms. Debug summary confirmed a ranked event plus three session-scoped fallback events. Exit 0.
2. Ran `bun docs/attachments/rank-omitted-reflections-with-jev/try-ranking.ts`. OpenRouter `~typesafe/jev-latest` returned `stop`; priority began `role`, `rule`, `f10`, `f11`. Renderer retained those four and omitted ten. Its newest-first comparison retained `rule`, `f9`, `f10`, `f11`, losing `role`. Latency **1,651 ms**; usage **4,043 input + 516 output tokens**; runtime catalog cost **$0.000169806 USD**, not a billing receipt. Exit 0.

## Expectations and replayable checks

- Overflow and supplied ordering: met through the prepared compaction surface and live renderer output. Replay both commands; accept retained role ahead of newer ordinary reflections, plus retained `rule` in the live result.
- Fit bypass: met according to offline CLI observation. Replay compaction command; accept no credential lookup or Jev call for fitting budget.
- Offline/error/timeout: met according to offline CLI observation. Replay compaction command; accept newest-first for all three, timeout within a few seconds, and three session-scoped fallback events.
- Live preservation, latency and cost: met as recorded above. Replay ranking command; accept role retained, completed provider response, latency and cost printed (values may vary).
- Source deletion/no regex and exact relevance prompt are not observable from these user-facing commands. Reviewer owns source inspection and required test/typecheck gates; these were deliberately not rerun here.

## Frictions and limits

No unresolved first-use friction encountered. Prepared compaction CLI reports summaries rather than dumping rendered context or logs; its claims were observed as CLI output, not independently inspected in implementation or fixtures. This is a synthetic library encounter, not a full interactive session compaction. No rendered UI, screenshots, servers, browser pages, or external resources were created. Both processes finished and temporary state cleanup is owned by the supplied compaction command.

