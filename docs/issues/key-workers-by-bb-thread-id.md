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
- The notice filter `extensions/bb/reconciler-notices.ts` finds reconciler-owned workers through `allThreads()` since `move-coordination-off-the-board`; port it to run state or bb too.
- `lib/session-meta/host.ts` and `lib/graph.ts` stop reading records; view-only fields (`seenAt`, `interactive`, `attention`, `terminals`, `delta`) go.
- A reconciler restarted mid-run reattaches its live workers; `bun test` passes.
- Supply a non-null runnable setup handoff for independent driving: local deployment kind, owned disposable repository/run, authentication requirements, seed/state, checkout-local commands for launch/readiness/crash/restart/inspection and cleanup, plus public metadata/graph and notice entry points. Prepare it and observe readiness before handing it off. The shared active reconciler is not a test target.

Stories (required handoff claims): Worker identity lookup; Recovery by bb title; Notice ownership filtering; Metadata and graph descriptions; Mid-run restart reattachment. Each needs action and observed result in `docs/attachments/key-workers-by-bb-thread-id/index.md`; the final reviewer reports every claim held on its final head. Record `bun test` separately as the suite gate. CLI help and existing tests do not establish these encounters.

Decision 2026-10-19 (drive-blocked exception): redispatch implementation to complete the missing runnable setup, not to discard the identity migration. Reuse/replay the existing implementation commits `0bf38e9a`, `edcc087d`, `989d8fc4` as appropriate against the current parent, preserving the sibling environment work. No product failure was observed: driver packet `5690ac6c` honestly leaves all five stories unobservable after a null setup handoff. Do not relabel them held, waive restart acceptance, or retry the same unsupported drive.

Preparation is authorized to create and clean up a disposable repository/run and its own workers, never to stop or edit this execution tree's run state. State isolation requires a separate Git common directory (a linked worktree shares reconcile state); a different working directory or `AB_STATE` alone is not isolation. Supply a deterministic missing-receipt seed and an owned mid-run interruption/restart procedure that reaches the reconciler loop, checking the same original bb id and no duplicate spawn, not merely a direct `wm.attach` call. Explicitly distinguish seeded/supplied-host observations from live bb observations; simulated workers alone must not be called live restart evidence. A controlled seam may support the crash-cut encounter but does not silently replace the live reattachment claim. Only terminate owned PIDs; cleanup must cover partial setup too.

The graph's independently meaningful `Node.interactive` classification is not prohibited by dropping the old registry-only view fields. Verify metadata/graph identity and provenance through their public surfaces, rather than asserting that every field sharing an old view-field name disappears everywhere.

Setup-handoff friction remains owned by [[projects/mlegls-pi/issues/supervised-study-drive-lacks-setup-handoff]]. This ruling changes no integration status; the migration and its required observations still await review and landing.
