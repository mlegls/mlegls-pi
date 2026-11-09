# Supervisor handover: first use

## Setup

From the package checkout:

```sh
bun docs/attachments/supervisor-handover-archives-workers-and-strands-reconciler-ownership/scratch.ts start
```

The command creates a disposable repository under `/tmp/supervisor-handover-*`, a fake bb CLI, a real reconciler and a real pickup watcher. It waits for the reconciler's handover-aware code to load, then prints the direct handover entry point and commands for status, resolution, later dispatch and cleanup. No models, daemon or credentials are used. Both supervisor identities and the worker are seeded in the fake CLI; the worker has reported needs-input. Pickup is enabled and paused so it cannot start extra work.

Use the printed `<root>/use` helper:

```sh
<root>/use desk handover thr_old thr_new
<root>/use status
<root>/use pickup
<root>/use resolve '{"action":"answer","message":"Use option A"}'
<root>/use dispatch later
<root>/use desk handover thr_old thr_new
<root>/use cleanup
```

To exercise a subsequent launch by the existing reconciler, resolve with `{"action":"retry"}` instead of answering; its single scratch stance uses the fake CLI too. The helper also accepts `bb show <thread>`, `bb list` and arbitrary desk commands. Its environment is isolated from the caller's real BB identity and tracker. Cleanup stops the owned reconciler and watcher, retires the scratch workers and removes the disposable repository.

## Implementer encounter

Tested code: `784f1370` for the final re-drive; `a77b28b2` for the initial encounter. Each encounter preceded its commit on the same executable code. Backend-only, no screenshots. This is implementation first use; fresh verification follows it.

- Handover reported two role/working rows, one attention item, one reconciler, the pickup owner and one child moved.
- Reconciler PID 827195 and watcher PID 827268 were unchanged. Status showed owner `thr_new`, the original implement worker held and the same `implement needs-input` exception pending.
- Worker `bbt-90ca789c` remained unarchived and parented to `thr_new`. The old supervisor was archived.
- Both desk files named the new owner and retained the question text.
- An answer submitted as the new supervisor cleared the exception and released the original chain. A later dispatch created `bbt-46b02a65` under `thr_new`.
- Repeating handover reported zero moved rows, no reconcilers and no children.
- The final notification-lock re-drive kept reconciler PID 866428 and watcher PID 866511. Re-escalating the preserved exception delivered its notice to `thr_new`; the archived `thr_old` received none. Answer, later dispatch and repeat handover succeeded again.
- On the final owner-identity code, a retry from the new owner made the existing reconciler (PID 1005576) dispatch `question-implement-2` / `bbt-989b26cd` under `thr_new`; its watcher stayed PID 1005658. The original worker survived handover and was retired only by that explicit retry. The exception cleared.
- Existing affected regression tests: 33 passed across dispatch, worker lifecycle/runtime, constraints, exceptions, pickup, resume and launch recovery. The exception/pickup subset also passed after serializing notifications with handover (8 tests); startup/resume checks passed after preserving explicit foreground ownership (3 tests). Final typecheck passed.

The fake CLI exercises real ownership/state/launch code and cascading sidebar archives. Live bb daemon archive behavior remains for the fresh driver to judge. No new permanent tests were added.
