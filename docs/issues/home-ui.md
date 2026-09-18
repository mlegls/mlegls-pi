---
next: prototype
part-of: "[[projects/mlegls-pi/issues/agentic-setup-reorg]]"
---

where the sidebar lives: bb (workspace over harnesses, pi first-class, panel plugins), the terminal (tmux, custom cockpit pane), the browser, or obsidian. the data — board, tracker vault, worktrees — is shared regardless; the views are per-home and written once for whichever wins.

prototype: a week in bb as home with pi threads. the library's substrate seam is `lib/ui` (spawn/focus/list/capture a pane or thread) with the first backend chosen by the trial. workmux follows the substrate: keep as a dependency on tmux, retire under bb (bb owns worktree + thread + sidebar; the worktree half is ~200 lines to reabsorb).

decisions:
- 2026-09-18: bb is a workspace/UI layer, not a competing harness; its threads are a multiplexer, not a mailbox, so the board stays.
