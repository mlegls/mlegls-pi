# Add an existing worktree

Implementation self-check on `e56adb8`, 2026-10-02. Standalone hacking pass, not independent acceptance.

The project + now uses the same `NSComboButton` as session actions: clicking + starts a new worktree, and its menu offers New Worktree / Add Existing Worktree…. The project context menu has the same existing-worktree action.

In an isolated native Threads instance, right-clicking the seeded project and choosing Add Existing Worktree… opened the folder chooser. It showed the existing checkout and “Add Thread”, with directory creation disabled. The chooser's AXSheet was reachable through the parent window tree, but Cua refused input as `element_outside_target_window`; observing the sheet's own WindowServer id returned `ax_window_unresolved`. No foreground escalation was attempted. The dropdown hover and full native selection journey remain with [[projects/mlegls-pi/issues/cua-cannot-address-threads-worktree-chooser]].

The real CLI route used by the app was checked separately in a temporary repository with a linked checkout named `existing worktree`, an untracked `local.txt`, and `branch.existing.ab-parent=main`:

- `ab tree do open --project '<worktree>/subdir'` created interactive guest `1f60c4c9-f920-4b71-a339-d38061dfa610` in the checkout root.
- Opening the root returned the same id; listing still contained only the seed and that guest.
- Opening a non-repository directory failed with exit 1 and no extra thread.
- `ab tree do abandon --id 1f60c4c9-f920-4b71-a339-d38061dfa610` closed the guest. The worktree, branch, dirty file contents and ab-parent were unchanged.

Temporary app and seeded terminals were stopped. Swift release build, 18 thread/tree regressions and root typecheck passed; typecheck required the existing [[projects/mlegls-pi/issues/root-setup-still-omits-obsidian-typecheck-dependencies|nested Obsidian dependency workaround]].
