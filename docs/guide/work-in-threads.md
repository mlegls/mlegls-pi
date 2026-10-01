---
for: maintainer
---

# Work in threads

Run `ab thread new --in "$PWD"` for a thread in the current checkout, or `ab thread new --worktree <branch>` for an owned worktree. To register an existing pi session, use `ab thread promote <session-file>`. Threads run in zmx; closing a window detaches, rather than stopping them.

Run `ab tree sidebar` from the project. It opens a fresh Ghostty window with two splits: the thread sidebar and one main terminal. Existing windows are untouched. Use this checkout's `bin/ab` when trying an uninstalled change. Ghostty on macOS needs its AppleScript dictionary; zmx comes from the project's mise setup.

The first row is shown immediately when the window opens; moving the selection later does not attach until Enter.

Point at a row to reveal its buttons. They wrap below the row in a narrow sidebar. Click the row, or select with j/k and press Enter, to show its `.agent` in the main split. `▌` marks the shown thread. Hovering, scrolling and j/k alone never attach. Click the fold arrow or press Space to hide/show descendants. Escape gives the keyboard to the bound main split; pointing at either split focuses it when Ghostty's `focus-follows-mouse` is enabled.

Click the heading, or use Tab/s, to switch between the spawn and merge trees. These are the same orders as `ab thread ls --tree spawn|merge`. `/` filters; submit an empty filter to clear it. A matching descendant keeps its ancestors visible. `r` refreshes; `R` reloads the sidebar code.

- **new** (`n`): a fresh guest thread in the pointed thread's checkout, with that thread as spawn parent.
- **new in worktree** (`N`): asks for a branch name, creates an owned worktree from the pointed checkout and records its branch as merge parent.
- **fork** (`f`): copies the pointed thread's current pi history into a new guest thread in the same checkout. It shows the new thread immediately.
- **merge** (`m`) and **archive** (`a`): the same recursive merge-and-retire operation. Owned spawned children retire first, then the selected branch merges into its recorded parent. Guests merge nothing. A conflict goes back to the conflicting agent, and the sidebar shows it as `⊘` with its reason at the bottom until the agent reports done; other lifecycle actions wait, but selecting a thread still switches the main split, so you can watch the agent resolve it.
- **abandon** (`x`): retires the thread and its spawned descendants without merging.
- **abandon all children** (`X`): abandons each immediate child in the currently displayed tree, recursively, keeping the pointed thread itself.

Merge, archive and abandonment ask `[y/N]`; type `y` and Enter to proceed, or Escape to cancel. They stop the retired threads' terminals; owned worktrees are removed. They are not merely "close window" actions.

Auxiliary shells, editors and servers aren't managed in this sidebar. Use plain Ghostty terminals separately. `q` closes the sidebar; closing the whole window leaves active threads running. Open another sidebar window to look at them again.

If the sidebar says another window leads the thread, type in this window's main split before switching. If it has no leader, reattach the main client or reopen the sidebar. zmx 0.8.1's underlying switch failure is tracked in [[projects/mlegls-pi/issues/zmx-switch-without-a-leader-kills-the-source]]; the sidebar refuses known unsafe switches.

Implementation first use: [[projects/mlegls-pi/attachments/tree-sidebar-over-threads/index]]. Story: [[projects/mlegls-pi/stories/work-in-threads]].
