---
stage: "done"
assignee: "agent"
author: "session:01a15212-f5c4-72f9-98e1-e4e2ab51097c"
part-of: "[[projects/mlegls-pi/issues/replace-the-board-with-bb-mail]]"
---
A `desk` helper does every write to `desk/ATTENTION.md` and `desk/ROLES.md`, and cleans both on each write.

Done:
- Finds `desk/` at the main checkout's root from any worktree (`git rev-parse --git-common-dir`), creating it and its `.git/info/exclude` line when missing.
- Sets and clears a role (`supervisor` and others) and a session's "working on" line; adds and removes an attention item (one `## ` item each, owned by its `@thread:…`).
- Before each write, removes lines and items whose bb thread is archived or deleted. An attention item of an archived thread goes too: once the asker is gone nobody acts on the answer, so an agent archiving its thread re-files anything still needed under a live one.
- Reachable by agents as a CLI and from the reconciler as a module. `universal.md`, `tend`, `supervise` and `shape` name it as the way to write these files.

## Verification
Independent drive: [encounter packet](../attachments/desk-helper-for-convention-files/index.md), commit `2f19b88a`. All four claims held through CLI/module/documentation surfaces; no rendered journey.


## Result

done

I reviewed the diff against the ticket and found nothing to repair. I made no commits, so the final head is the driver's `2f19b88a`.

- **Ticket checks:** `lib/desk.ts` does what the ticket asks.
  - It finds the main checkout's `desk/` from a worktree and adds the `/desk/` line to `.git/info/exclude`.
  - Role, working-line and attention add/remove behave as specified, and repeating a title replaces that item.
  - Each write drops archived and unknown owners from both files.
  - A failed bb lookup aborts the write instead of treating every owner as deleted.
  - Writes take a lock and replace each file atomically.
  - `bin/desk`, `ab desk` and the module are reachable, and `universal.md`, `tend`, `supervise` and `shape` name `ab desk`.
- **My own run:** In a disposable linked worktree, I added an attention item from stdin as the current live thread, then seeded a `thr_gone` working line in `ROLES.md`. A `working set` write removed the `thr_gone` line and kept the live item and line. `/desk/` was in the main checkout's exclude file.
- **Tests and friction:** I ran no test suite, because the change adds none and touches no existing test. No tracker frictions were linked in the packet.

```yaml
commit: 2f19b88a
stories:
  - story: Shared main-checkout desk discovery and exclusion
    outcome: held
  - story: Role, working-line and attention mutations
    outcome: held
  - story: Archived/deleted-owner cleanup across both files
    outcome: held
  - story: CLI/module access and instruction guidance
    outcome: held
evidence:
  path: docs/attachments/desk-helper-for-convention-files/index.md
  visual: false
  shots: []
tests: []
filed: []
caveats:
  - Deleted-owner cleanup is exercised with a nonexistent thread id, not a newly deleted real thread. This also holds for my run.
  - A crashed writer leaves `desk.lock` in the main git directory. Later writes then wait 30 s and fail with an error naming the lock path. The user removes the lock by hand.
  - Each write costs one `bb thread list --include-hidden` call, about 0.3 s in my run, in return for always-current cleanup.
```

Evidence: [docs/attachments/desk-helper-for-convention-files/index.md](docs/attachments/desk-helper-for-convention-files/index.md)
