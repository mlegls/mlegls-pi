---
stage: ticket
assignee: agent
author: session:01a0f69a-dbcb-7684-87de-422739d2c54e
part-of: "[[projects/mlegls-pi/issues/thread-registry-on-zmx]]"
blocked-by: ["[[projects/mlegls-pi/issues/thread-commands-in-pi]]", "[[projects/mlegls-pi/issues/tree-sidebar-over-threads]]", "settled: concept reconcilers (mail/2d15485e)"]
priority: 2
---

Session mode: hacking. Once [[projects/mlegls-pi/issues/thread-core-and-workers-on-zmx]], [[projects/mlegls-pi/issues/thread-commands-in-pi]] and [[projects/mlegls-pi/issues/tree-sidebar-over-threads]] are in and the remaining workmux worktrees have drained (the `dsh-…__worktrees` ones are stale), delete what's left of workmux and tmux: workmux calls and `.workmux.yaml`, `@mailbox` in `lib/board/host.ts`, `tmuxPane` in live records, tmux paths in `lib/tree/`, and the workmux config in `~/.config/system-config` (commit there). Docs that describe workers as workmux worktrees + tmux windows (`docs/dispatch.md`, the supervision namespace description) move to threads.

Remove code only: the workmux and tmux binaries stay installed. Two concept reconcilers (garden-the-browser-replays-into-story-scenarios-that-run, link-delayed-evidence-to-last-teaching) run on the workmux path from pre-core main and may restart from it; the guard clears when concept's supervisor (mail/2d15485e) reports both trees settled.
