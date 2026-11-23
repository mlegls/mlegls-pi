---
stage: "idea"
assignee: "agent"
priority: 3
author: "session:01a20657-0e8d-726c-98b9-a4f79a5a23fc"
---
Found in the 2026-11-23 audit of the supervision/issue orchestration system (@thread:thr_3pkhxrd57p).

> [turn.ts](../../lib/thread/turn.ts#L102-L104) can wedge its cursor at an orphaned event and re-scan full history every 5s.

`readTurn` lowers the next cursor to `seq - 1` of every still-open item (a final message or provider error awaiting its completion). An item whose completion never comes keeps the cursor there forever. Awaiting a reproduction from a live thread log; a repair likely bounds how long an open item can hold the cursor.
