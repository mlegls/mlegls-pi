---
stage: "ticket"
assignee: "agent"
author: "session:01a15212-f5c4-72f9-98e1-e4e2ab51097c"
---
OM's Reflections section in the compaction summary only grows, and a continued session lost all of it.

Measured in the concept supervisor's session (`~/.bb/pi-bridge-sessions/thr_vetzcc74ex.jsonl`, 10-03 to 10-19, 18 compactions): Reflections went from 0 to 627 lines (214k chars, ~54k tokens), carried on every call; `observationsPoolMaxTokens` (20k, `extensions/context/om/hooks/compaction-hook.ts`) bounds only Observations, which stayed ~40k chars. Context p50 was 186k, p90 380k, over 6,126 calls ($1,120 total).

At the 2026-10-19T01:48 compaction, right after the session continued from a rewound file (`parentSession: thr_vetzcc74ex_rewind_….jsonl`), the summary had no Reflections at all: the role designation ("persistent top-level tend supervisor") and the "red verify:main blocks landings" rule were gone.

Wanted: reflections held to a budget (consolidated or dropped like observations), and carried across a bb rewind/continuation.


## Amendment (2026-10-19, maintainer)

The condenser and the rewind fix landed (8d009f62, 964b60ef). Two changes before closing:

- **Port upstream's render budget.** Take `renderSummaryWithBudget` from elpapi42/pi-observational-memory (`src/session-ledger/render-summary.ts`, `resolveCompactionSummaryMaxTokens` in `src/config.ts`, at 022da5e) with its defaults. The summary budget is `compactionSummaryMaxTokens`, else one eighth of the session model's context window, else 8,000. Observations are reserved at least half, newest first, and reflections get the remainder. Omitted records are named in a trailing line, and they stay recallable.
- **The condenser becomes a storage safety bound, not the main one.** Defaults: `reflector.maxTokens` 60k, `reflector.targetTokens` 40k. It was lossy (85%) at 12k/8k.

Done also when:
- A compaction on a session with more reflections than the summary budget renders within budget, with the omission line.
- `bun test extensions/context/om` and `bunx tsc --noEmit` pass.
- The concept supervisor's next compaction after reload carries its role reflection.
