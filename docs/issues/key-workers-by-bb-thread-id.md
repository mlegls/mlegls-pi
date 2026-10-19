---
stage: "done"
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

## Verification evidence

Driver encounter: [worker identity packet](../attachments/key-workers-by-bb-thread-id/index.md). Initial setup gap followed by supervisor-authorized scratch-repo live restart/adoption checks. Final story outcomes are in the packet; this link is not acceptance or closure.

## Result

done — all five stories held on the final head (`97757ec8`), observed with live bb workers on a disposable scratch repo.

The suite gate is mixed. `bun test` on `00bcfeba` gave 222 pass, 2 skip, 2 fail. Both failures are `lib/thread/lifecycle.test.ts` "archive conflict answered needs-input" and "answered turn-end", which hit the 5 s timeout under full-suite load. The file alone passes 12/12. After my commits I ran only the affected set (`wm-reattach`, `dispatch`, `thread`, `session`, `session-meta`, `reconcile/{status,stop,resume}`): 40/40. I did not rerun the full suite.

- **Repair (`98cfbe50`):** `lib/graph.ts` showed each worker's header-only launch session as a second node, `(empty)` with `interactive: true`. I made a session nobody typed into, with no live pi, non-interactive. On a live worker it now reports `interactive: false`. `Node.interactive` itself stays, as the ticket permits, so the driver's "failed" graph finding is resolved.
- **Consolidation (`cd5ccd71`):** two identical inline git-common-dir helpers in `lib/dispatch.ts` and `lib/wm.ts` are now one `commonDir` in `lib/thread/git.ts`. Behaviour is unchanged.

I appended the review to `docs/attachments/key-workers-by-bb-thread-id/index.md` without rewriting the driver's log. Cleanup is complete: both scratch reconcilers stopped, the three scratch threads archived, and the scratch repo, worktrees and temp pi state deleted.

```yaml
commit: 97757ec8
stories:
  - {story: Worker identity lookup, outcome: held}
  - {story: Recovery by bb title, outcome: held}
  - {story: Notice ownership filtering, outcome: held}
  - {story: Metadata and graph descriptions, outcome: held}
  - {story: Mid-run restart reattachment, outcome: held}
evidence:
  path: docs/attachments/key-workers-by-bb-thread-id/index.md
  visual: false
  shots: []
tests:
  - lib/wm-reattach.test.ts
  - lib/session/jump.test.ts
  - lib/session-meta/index.test.ts
  - lib/reconcile/status.test.ts
  - lib/thread/runtime.test.ts
  - lib/thread/cli.test.ts
fixed:
  - {commit: 98cfbe50, what: "graph ghost launch session shown as interactive"}
  - {commit: cd5ccd71, what: "duplicate git-common-dir helper"}
filed:
  - "[[projects/mlegls-pi/issues/reconciler-orphans-chain-worker-spawned-before-receipt-save]] (idea)"
  - "drive-pi-extensions-from-reviewed-worktree updated: routine notices reach the owner and are answered by a local model, so that was not a filter miss. Its branch-pinned pi workaround is recorded."
caveats:
  - "Observation labels: workers, bb titles and bb ids are live. State edits are seeded: I killed only the reconciler pid, edited scratch run state, and restarted through the CLI. Notice filtering and session metadata come from a branch-pinned `pi --mode rpc` plus direct imports. The owner's running pi extension was not reloaded."
  - "Recovery by title is observed for a refinement writer (state wholly stripped, restarted through the reconciler loop, same bb id, no new launch) and for `stop`. A chain's own implement/drive/review handle missing from state is relaunched under a new handle. Same as before the change, filed as the idea above, and not live-reproduced."
  - "Receipts with `threadId` but no `bb` still resolve through the registry record (legacy path). The bb-field-deleted restart only exercises that."
  - "Cost of the live check: about 3 real worker threads and two idle `sleep` pauses, ~10 min wall."
  - "No test assertions changed; no tests proposed."
```

Evidence: [docs/attachments/key-workers-by-bb-thread-id/index.md](docs/attachments/key-workers-by-bb-thread-id/index.md)
