# Independent CLI drive

Tested revision: e6b409ead4966f62a9f965a01d69822d14e25efc. Backend-only; no screenshots.

## Predictions recorded before use

- Moving thr_old to thr_new moves the role, attention and pickup ownership, and prints each movement.
- The running reconciler changes owner and notification target while its needs-input exception remains pending; the new owner can resolve it.
- The live worker remains unarchived and gains thr_new as parent. A subsequent dispatch succeeds.
- The old supervisor is archived without its worker; repeating handover is harmless.

## Setup and readiness

Ran the committed `bun docs/attachments/supervisor-handover-archives-workers-and-strands-reconciler-ownership/scratch.ts start` from this worktree. It created owned `/tmp/supervisor-handover-rJZdqt/repo`, real Git/reconciler/watcher and fake BB CLI. Personas thr_old/thr_new require no authentication. No inherited deployment selectors were reused. Setup completed successfully before any drive. Initial `use status` confirmed running, non-stale reconciler owned by thr_old, held worker question-implement-1 / bbt-5a73b9f3 and pending `implement needs-input`. Pickup was enabled, paused, owned by thr_old, watcher PID 1043331. Reconciler PID was 1043241.

## Actions and observations

All commands below use the setup-printed `/tmp/supervisor-handover-rJZdqt/use` helper; repeat setup to obtain a fresh prefix.

1. `desk handover thr_old thr_new` succeeded. Its summary reported two role/working rows, one attention item, reconciler question, pickup owner thr_new with unchanged watcher PID, and child bbt-5a73b9f3 moved; canSpawnChild true; archived thr_old.
2. `status` still showed the same held worker and pending exception, with owner thr_new. `pickup` showed thr_new, unchanged enabled/paused state and PID. `ps -p 1043241,1043331 -o pid=,stat=,comm=` showed both original Bun processes alive.
3. `bb show bbt-5a73b9f3` showed archivedAt null and parentThreadId thr_new. `bb show thr_old` showed a non-null archive timestamp. Reading the scratch desk files showed role and working rows owned by thr_new and the unchanged question under Owner thr_new.
4. `resolve '{"action":"retry"}'` succeeded. `status` showed exceptions empty and question-implement-2 / bbt-c0f1c640 launched. `bb list` showed this new reconciler worker unarchived and parented to thr_new. The original worker was archived only by this explicit retry, after its survival of handover was observed.
5. `dispatch later` returned submitted handle later / bbt-451e852f with pending empty. `bb list` confirmed parent thr_new and archivedAt null.
6. Repeating `desk handover thr_old thr_new` succeeded with zero desk rows, no reconcilers, no children and pickup null (nothing moved). Existing new-owner workers remained unarchived. Pickup remained owned by thr_new with the same watcher PID.

## Outcomes, expectations and replayable checks

- Desk/pickup transfer and printed summary: held; prediction met. Replay steps 1–3 and compare owners, preserved question text and watcher PID.
- Pending exception preserved and resolvable by new owner: held; prediction met. Replay steps 1, 2 and 4; require unchanged pending exception before resolution, then empty exceptions and a new worker parented to thr_new.
- Worker survival/reparenting and later dispatch: held; prediction met. Check archivedAt null before retry, parent thr_new both before and after subsequent dispatch, and pending empty in dispatch result.
- Old owner archived and idempotent repeat: held; prediction met. Compare archive state and repeat summary in steps 3 and 6.
- Notification routing: no notification was generated during this encounter (both supervisors' tells remained empty). Ownership transfer was visible; delivery itself was not measured. This packet makes no independent notification-delivery claim.

## Frictions and limits

No behavioral friction encountered through the provided CLI. The scratch `bb show` result wraps fields in `thread`; an initial local output projection produced `{}`, then inspecting the documented command's complete result and correcting the projection established the worker state.

The supplied environment substitutes a fake BB CLI for the daemon, including child permissions, parent mutation and cascading archive. These outcomes establish the provided scratch acceptance, not live BB desktop behavior. No source, tests or fixtures were read, no tests were run, and no product changes were made. Cleanup used the setup-owned cleanup command; no shared services were touched.

## Review

Reviewed the handover commits (a77b28b2, 784f1370) against the driver's packet. Read lib/handover.ts, the desk/pickup/ownership-lock/reconciler owner-refresh changes and the bb CLI wrappers; confirmed on this host's real bb that `bb thread show` returns `canSpawnChild` and `bb thread update` takes `--parent-thread`/`--clear-parent-thread`, matching the wrappers. Ran `bun test` over lib/reconcile, dispatch, wm, wm.local and wm-reattach: 66 pass, 1 skip (pre-existing), 0 fail. Typecheck failed on one unrelated test (OM notify spy signature); fixed in a separate commit and now clean. No defects in the handover change; all six stories hold on the final head. The scratch drive was not repeated: the changed head differs from the driven revision only by the test-file typing fix.
