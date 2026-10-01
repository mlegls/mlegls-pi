---
stage: goal
assignee: human
author: session:01a0f69a-dbcb-7684-87de-422739d2c54e
priority: 2
---

Replace the tmux sidebar/dashboard with threads over zmx and, eventually, a native sidebar in a Ghostty fork. Comes from limits of tmux itself (scrollback, focus between the sidebar and the main pane, strays from windows/sessions nobody owns), and from the TUI sidebar having no hover or buttons ("i often accidentally scroll through the sidebar and accidentally open a bunch of closed sessions i meant to just 'hover' on").

The model:
- a **thread** is one agent session with a cwd, plus auxiliary terminals (lg, yazi, nvim, servers).
- a **project** is a default cwd with worktrees. Spawning a thread in the default cwd or a new worktree, and merging any worktree, should be easy.
- threads sit in two trees, worktree merge order and session parentage, each a sidebar mode.
- **archive** closes everything a thread spawned, recursively, and merges it into its parent recursively (children first). **abandon** archives without merging. Merging only part of a subtree means abandoning the other children first (or "abandon all children").

These are nested-transaction commit and abort, as in [[projects/mlegls-pi/issues/project-scoped-sessions-and-worktrees]].

substeps:
1. [[projects/mlegls-pi/issues/check-zmx-reattach-with-pi]]: decides how the fork's main area holds surfaces.
2. [[projects/mlegls-pi/issues/thread-registry-on-zmx]]: the CLI both frontends sit on.
3. [[projects/mlegls-pi/issues/tree-sidebar-bridge-fixes]]: makes the current TUI sidebar tolerable on top of 2; parallel with 2 for the parts that don't need it.
4. [[projects/mlegls-pi/issues/native-thread-sidebar-in-a-ghostty-fork]]

decisions:
- 2026-10-01: detach is required ("i'll have 10s of non-interactive sessions and they can't be tabs"), but it comes from zmx, not a multiplexer. zmx keeps one daemon per terminal, restores screen state on reattach via libghostty-vt, keeps native scrollback, and does no windows/tabs/splits. shpool is the Rust equivalent; dtach/abduco lack the state replay. Prior statement: "You might not need tmux" (bower.sh).
- 2026-10-01: the main UI is terminals only. No file viewer, delta viewer or PR UI beyond automatic commit/merge. The sidebar is the two trees. That's what Paseo, Orca and Conductor get wrong for this use.
- 2026-10-01: not forking cmux. It's ~570k lines of Swift, with BUSL-licensed server parts beside the GPL app, and its opt-in detach (`cmux local-tmux`) is `tmux attach` in a Ghostty surface, which brings the scrollback problem back. Ghostty's own macOS app (MIT, the reference GhosttyKit embedder) is the fork base.
- 2026-10-01: workmux goes away; it's tmux-coupled. Worktree create/remove is small enough to own, and its project-setup hooks move into the registry.
- 2026-10-01: Ghostty's tmux control mode (ghostty#9860, core loop only, no GUI) would someday make tmux a native-rendered backend like iTerm2's `tmux -CC`. Not waiting on it; zmx is simpler.

shape:
- zmx owns ptys. Every terminal is a zmx session named `<thread-id>.<role>` (`.agent`, `.lg`, `.server`); non-interactive threads are zmx sessions nobody is attached to.
- the registry owns structure: `lib/tree/graph.ts` plus a branch-parent field. Ownership is in the names, so a zmx session not matching a live thread is a stray by definition.
- the UI is a pure view: the two-tree sidebar plus a main area whose surfaces run `zmx attach …`. Switching threads swaps which sessions are attached.
