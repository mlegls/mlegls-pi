---
stage: "ticket"
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

