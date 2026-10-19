---
stage: "ticket"
assignee: "agent"
author: "session:01a15212-f5c4-72f9-98e1-e4e2ab51097c"
---
OM's Reflections section in the compaction summary only grows, and a continued session lost all of it.

Measured in the concept supervisor's session (`~/.bb/pi-bridge-sessions/thr_vetzcc74ex.jsonl`, 10-03 to 10-19, 18 compactions): Reflections went from 0 to 627 lines (214k chars, ~54k tokens), carried on every call; `observationsPoolMaxTokens` (20k, `extensions/context/om/hooks/compaction-hook.ts`) bounds only Observations, which stayed ~40k chars. Context p50 was 186k, p90 380k, over 6,126 calls ($1,120 total).

At the 2026-10-19T01:48 compaction, right after the session continued from a rewound file (`parentSession: thr_vetzcc74ex_rewind_….jsonl`), the summary had no Reflections at all: the role designation ("persistent top-level tend supervisor") and the "red verify:main blocks landings" rule were gone.

Wanted: reflections held to a budget (consolidated or dropped like observations), and carried across a bb rewind/continuation.
