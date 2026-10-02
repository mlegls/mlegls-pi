---
stage: ticket
assignee: agent
author: session:01a0f69a-dbcb-7684-87de-422739d2c54e
part-of: "[[projects/mlegls-pi/issues/thread-registry-on-zmx]]"
blocked-by: ["[[projects/mlegls-pi/issues/thread-commands-in-pi]]", "[[projects/mlegls-pi/issues/tree-sidebar-over-threads]]"]
priority: 2
---

Session mode: hacking. Once [[projects/mlegls-pi/issues/thread-core-and-workers-on-zmx]], [[projects/mlegls-pi/issues/thread-commands-in-pi]] and [[projects/mlegls-pi/issues/tree-sidebar-over-threads]] are in and the remaining workmux worktrees have drained (the `dsh-…__worktrees` ones are stale), delete what's left of workmux and tmux: workmux calls and `.workmux.yaml`, `@mailbox` in `lib/board/host.ts`, `tmuxPane` in live records, tmux paths in `lib/tree/`, and the workmux config in `~/.config/system-config` (commit there). Docs that describe workers as workmux worktrees + tmux windows (`docs/dispatch.md`, the supervision namespace description) move to threads.

Remove code only: the workmux and tmux binaries stay installed. Concept's supervisor reported (2026-10-02) that no workmux reconcilers remain there: garden runs on the threads reconciler and link-delayed is done. lib/reconcile already moved onto threads in 0be483a; graph.ts and children.ts still mention workmux.
