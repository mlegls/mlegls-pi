---
stage: "ticket"
assignee: "agent"
author: "session:01a15212-f5c4-72f9-98e1-e4e2ab51097c"
part-of: "[[projects/mlegls-pi/issues/retire-the-ab-thread-registry]]"
---
The reconciler, wm, the session-meta host and `graph.ts` find and describe workers without the `ab thread` registry.

Done:
- Run state holds each worker's bb thread id, run and handle; `workerThread` and `allThreads` callers read it (or bb) instead of records.
- A worker spawned just before a reconciler crash, absent from run state, is recovered from its bb title `<run>/<handle>`.
- `lib/session-meta/host.ts` and `lib/graph.ts` stop reading records; view-only fields (`seenAt`, `interactive`, `attention`, `terminals`, `delta`) go.
- A reconciler restarted mid-run reattaches its live workers; `bun test` passes.
