---
stage: "ticket"
assignee: "agent"
priority: 3
author: "session:01a20657-0e8d-726c-98b9-a4f79a5a23fc"
---
Found in the 2026-11-23 audit of the supervision/issue orchestration system (@thread:thr_3pkhxrd57p).

> ~350 of 551 lines in [wm.ts](../../lib/wm.ts) (`Poller`, `Worker.{turn,observe,next,events,done,send,capture,exec,status}`, `wait`, `merge`, `from: "summary"`, CLI), `executable()` ([process.ts](../../lib/thread/process.ts#L14)), `lastTurn` ([turn.ts](../../lib/thread/turn.ts#L122)), `.wm/setup.json` reader ([setup.ts](../../lib/thread/setup.ts#L17))

Delete what nothing imports (confirm each with a grep across the repo, bb-plugins and skills scripts). [views.ts](../../lib/views.ts) stays: the `orient` skill runs it. Also in [dispatch.ts](../../lib/dispatch.ts) `retire()`: it makes 3 redundant `bbThreads()` RPCs and can return `branchDeleted` together with `branchesKept: keepBranch requested`.
