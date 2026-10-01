---
stage: goal
assignee: human
author: session:01a0f69a-dbcb-7684-87de-422739d2c54e
part-of: "[[projects/mlegls-pi/issues/threads-on-zmx-with-a-native-sidebar]]"
priority: 2
---

A CLI (under `ab`) for threads over zmx that any frontend can sit on: list threads in either tree order, spawn a thread in a project's default cwd or a new worktree, attach/detach its terminals, and archive/abandon. See [[projects/mlegls-pi/issues/threads-on-zmx-with-a-native-sidebar]] for the model.

shape:
- source of truth for sessions stays `lib/tree/graph.ts` (session files, parent links, live records, board reports), which is already mux-independent. The registry adds a branch parent per thread and the zmx sessions it owns.
- zmx sessions are named `<thread-id>.<role>`, so reconciling `zmx list` against live threads finds strays mechanically.
- archive: post-order walk. For each node, archive its children, merge its branch into its parent's, `zmx kill <thread>.*`, remove the worktree. Abandon is the same walk without the merge. "Abandon all children" is a convenience over that.
- worktree create/remove is owned here, with the project-setup hooks workmux used to run.

holes:
- where merge order is stored. Candidates: git-town's lineage in git config (`git-town-branch.<b>.parent`, which also gets ship/sync along it), git-branchless, or our own field. jj models it natively; see [[projects/mlegls-pi/issues/project-scoped-sessions-and-worktrees]] for jj vs git. Within a project merge order mostly equals session parentage, so it may be derivable from parentage plus a few overrides (cross-project spawns, handoffs). Overrides are what drag-to-reparent in the native sidebar would write.
- what happens to `lib/wm.ts`, `lib/dispatch.ts` and the reconciler, which launch workers as workmux worktrees + tmux windows. They should launch threads instead.
- conflicts during archive: stop the walk at the conflicting node and surface it, or hand it to the parent thread's agent.
