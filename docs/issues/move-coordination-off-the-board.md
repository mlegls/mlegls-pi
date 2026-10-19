---
stage: "ticket"
assignee: "agent"
author: "session:01a15212-f5c4-72f9-98e1-e4e2ab51097c"
part-of: "[[projects/mlegls-pi/issues/replace-the-board-with-bb-mail]]"
blocked-by:
  - "[[projects/mlegls-pi/issues/drop-reconciler-worker-notices-in-a-bb-plugin]]"
---
The reconciler, wm, dispatch and session tools coordinate through bb and `desk/` instead of the board, then the board is deleted.

Done:
- Mail, wakes and follow-ups are `bb thread tell --mode queue` by thread id; `lib/thread/bb-wake.ts` and the `thread/<session>` mirror go.
- The reconciler reads worker status from bb turn completions; `reconcile_constrain` reaches workers as bb messages; exceptions and run completion are told to the owner's thread.
- Sibling `decision` posts and the `follow` subscription are removed, with their text in `agents/_common.md`.
- The supervisor is found through `desk/ROLES.md`; `role/` scopes go.
- Then `lib/board`, the board tools and extension hooks are deleted; `recall` and the session tools stop reading board messages. Skills and docs naming the board or mailboxes are updated.
- `bun test` and `bunx tsc --noEmit` pass; one live reconcile runs end to end through bb.

## Live verification setup decision (2026-10-19)

The driver is authorized to create one uniquely named disposable `stage: ticket`, `assignee: agent` fixture through the global tracker, outside this active execution subtree (no `part-of` or blockers). Its only implementation work is to commit a harmless marker document under `docs/attachments/move-coordination-off-the-board/`; no production behavior or new automated tests. State that it is a disposable live-reconcile fixture and link this ticket in its body. The fixture's acceptance is that its marker lands locally and can be read; it must not start another reconciler.

Run this fixture with the candidate checkout's CLI, the driver's own bb thread as owner, explicit `--land local`, and budget 1. The only authorized landing target is the driver's owned checkout `/Users/mlegls/dev/mlegls-pi__worktrees/move-coordination-off-the-board-drive-e` and its worker branch, not canonical main, this parent tree's collector, another live issue or a PR. Verify the run's captured cwd/target before allowing integration. Creation, worker dispatch and fixture-only issue closure by this disposable reconciler are authorized setup for the already-required live run; do not recursively start this ticket or its parent.

Deliver a real constraint through the candidate CLI and retain bb thread/message identifiers proving delivery to the fixture worker, consumption of its completed status, and completion notification to the driver. Record the candidate revision and captured local target in the evidence packet. Runtime evidence must use the candidate checkout's surfaces, not the handler/session's preloaded board tools. Any owned desk setup must not overwrite shared standing roles; do not restart/upgrade the shared bb server or change its global bridge configuration. Stop the disposable run and retire its remaining owned workers when finished; preserve its marker/evidence and closed fixture record for traceability. This supplies missing setup authority, not acceptance: the end-to-end bb claim remains unobserved until driven successfully.
