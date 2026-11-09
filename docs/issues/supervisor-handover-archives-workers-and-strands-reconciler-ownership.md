---
stage: "done"
assignee: "agent"
priority: 2
author: "session:thr_pqt8kgvd8h"
---
A supervisor takeover leaves execution attached to the old supervisor, and the steps that move it are done by hand and go wrong.

Evidence (efficiency audit 2026-11-05, @thread:thr_pqt8kgvd8h):
- 11-04: after a 403 `verification_required` stopped @thread:thr_a35xhciju2, the user asked @thread:thr_ihbpyrp6s2#msg=1 to take over as main supervisor. Archiving the old thread also archived 9 of its workers, 7 of them waiting on the user's answers; they were unarchived and reparented by hand (@thread:thr_ihbpyrp6s2#msg=611). Workers it spawned showed as siblings until the user noticed (#msg=431).
- The pickup watcher and 8 reconcilers kept the archived thread as owner, so the next launch (`draw-the-mission-run-past-now-and-future`) failed; found about 2h later and fixed by stopping and restarting each process from the new thread (#msg=798).
- 11-02: the same slip in reverse: reconcilers restarted from the efficiency-audit thread inherited its identity, and a review worker reported there instead of to the supervisor (@thread:thr_ae8q9yrxnv).

Ticket: one idempotent operation, e.g. `ab desk handover <old> <new>` (or a `reconcile` adopt), that
1. moves the ROLES entry, the old owner's `desk/ATTENTION.md` items and the pickup owner to the new thread;
2. re-points every running reconciler and the watcher (owner and notification target) without stopping workers or withdrawing pending exceptions;
3. reparents the old thread's live children to the new one;
4. checks the new owner can launch a worker, then archives the old thread without cascading to its children;
5. prints what it moved.

Acceptance: on a scratch supervisor with one reconciler holding a needs-input exception and one live worker, handover leaves the worker unarchived and parented to the new thread, `reconcile_status` shows the new owner, the exception is still pending and resolvable from the new thread, a later dispatch succeeds, and the old thread is archived.

## Result

done: I found no defects in the handover change, and all six stories hold on the final head. The scratch drive wasn't repeated, because my commits touch only a test file and the packet.

- **Code read:** I read `lib/handover.ts`, `lib/desk.ts`, `lib/reconcile/ownership.ts`, `lib/reconcile/pickup.ts` and the reconciler owner-refresh changes. I also checked the `bb` wrappers against the real CLI on this host. `bb thread show` returns `canSpawnChild`, and `bb thread update` takes `--parent-thread` and `--clear-parent-thread`, as the code expects.
- **Tests:** I ran `bun test` over `lib/reconcile`, `dispatch`, `wm`, `wm.local` and `wm-reattach`: 66 pass, 1 skip (the skip was already there), 0 fail. The repo has no `test:affected` task, so I ran those directories directly.
- **Fix:** the typecheck failed on one test, `extensions/context/om/runtime.test.ts`, which came in with the OM-fallback ticket merged into this base. I widened its `notify` spy signature in `cfcb0657`. Typecheck is clean and that test file's 3 tests pass.
- **Review notes:** I appended them to the driver's `drive.md` in `6a9a7db7`.
- **Friction:** the driver reported none and the handoff links no filed issues, so there was nothing to settle.

```yaml
commit: 6a9a7db7
stories:
  - story: Desk roles, attention and pickup transfer with a printed summary
    outcome: held
  - story: Running reconciler changes owner while preserving its pending exception
    outcome: held
  - story: New owner resolves the exception and the existing reconciler launches another worker
    outcome: held
  - story: Live worker survives handover and is reparented to the new supervisor
    outcome: held
  - story: Later dispatch succeeds under the new supervisor
    outcome: held
  - story: Old supervisor is archived and repeated handover is harmless
    outcome: held
evidence:
  path: docs/attachments/supervisor-handover-archives-workers-and-strands-reconciler-ownership/drive.md
  visual: false
  shots: []
tests: []
fixed:
  - "extensions/context/om/runtime.test.ts notify spy type error (typecheck) — cfcb0657"
filed: []
caveats:
  - "Scratch drive used a fake BB CLI, so live daemon archive and parenting behavior wasn't exercised. Real `canSpawnChild` and `thread update` flags were checked by command only."
  - "Notification delivery wasn't independently measured by the driver. The implementer's re-drive saw a notice reach thr_new and none reach the archived thr_old."
  - "handover refuses, by design, while a running reconciler hasn't loaded handover-aware code, or while a landing target sits in the old supervisor's managed worktree. Retry after the reconciler's code refresh."
```

Evidence: [docs/attachments/supervisor-handover-archives-workers-and-strands-reconciler-ownership/drive.md](../attachments/supervisor-handover-archives-workers-and-strands-reconciler-ownership/drive.md)
