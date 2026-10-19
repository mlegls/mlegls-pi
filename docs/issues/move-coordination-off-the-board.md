---
stage: "done"
assignee: "agent"
author: "session:01a15212-f5c4-72f9-98e1-e4e2ab51097c"
part-of: "[[projects/mlegls-pi/issues/replace-the-board-with-bb-mail]]"
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

## Result

done — all three stories hold on the final head. The one failure in the driver's packet was a stale worker preamble, not a defect in the diff.

- **Worker instructions:** the scratch worker's prompt came from `~/.pi/agent/agents`, which is a symlink into the canonical checkout. That copy is unmerged, so it still had the board paragraph. The branch's `agents/_common.md` and `agents/roles/handle.md` have no `board_send`, `board_read` or decision text, so it takes effect when the branch lands.
- **Desk fallback:** I ran it in a throwaway repo, since deleted. I set `supervisor` to a live thread and checked that `roleThread` returns it. I checked that a nonexistent owner isn't live in `bbThreads()`. I did not run `tellOwner` itself; I read it against that outcome and it picks the supervisor in that case. With no role set it falls back to the owner.
- **Recall:** held by inspection, not by running a checkout-loaded session. `recall.ts` no longer mentions the board. Old board records stay readable.
- **Typecheck and tests:** `bunx tsc --noEmit` is clean. `bun test lib extensions/supervision extensions/context extensions/bb` gave 176 pass, 2 skip and 1 fail. The fail was `archive conflict answered checkpoint…`, which timed out at 5 s under host load. It passed when I reran `lib/thread/lifecycle.test.ts` (12 of 12). The project has no `test:affected` task, so I ran those directories directly.

The reviewed head is 7d516b08. The reconcile CLI fix and the cleanup are in separate commits.

```yaml
commit: 7d516b08 (repairs fad39b76, 1728e6fa)
stories:
  - story: Live reconcile, constraints and completion through bb
    outcome: held
  - story: Worker instructions no longer reference board coordination
    outcome: held
  - story: Desk supervisor fallback and board-free recall
    outcome: held
evidence:
  path: docs/attachments/move-coordination-off-the-board/index.md
  visual: false
  shots: []
fixed:
  - reconcile CLI `--help`/`-h` prints usage and exits 0 instead of a parse stack trace (fad39b76; issue reconcile-cli-help-rejects-help closed)
  - stale owner-handover comment in lib/reconcile/reconcile.ts and a double blank line in agents/_common.md (1728e6fa)
filed:
  - none. Both friction issues were closed with a disposition:
    - scratch-reconcile-worker-retains-board-instructions: environmental; the installed template was the unmerged canonical copy
    - reconcile-cli-help-rejects-help: fixed
tests: []
caveats:
  - Desk fallback was checked on the selection logic with a real bb thread, not by a live reconcile with an archived owner.
  - Processes started by the review: none left running. The scratch desk repo in /tmp was deleted.
```

Evidence: [docs/attachments/move-coordination-off-the-board/index.md](docs/attachments/move-coordination-off-the-board/index.md)
