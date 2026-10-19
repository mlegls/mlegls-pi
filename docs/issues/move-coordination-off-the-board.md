---
stage: "ticket"
assignee: "agent"
author: "session:01a15212-f5c4-72f9-98e1-e4e2ab51097c"
part-of: "[[projects/mlegls-pi/issues/replace-the-board-with-bb-mail]]"
blocked-by:
  - "[[projects/mlegls-pi/issues/desk-helper-for-convention-files]]"
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
