---
stage: goal
assignee: human
author: session:01a0f69a-dbcb-7684-87de-422739d2c54e
part-of: "[[projects/mlegls-pi/issues/threads-on-zmx-with-a-native-sidebar]]"
priority: 2
---

A CLI (under `ab`) for threads over zmx that any frontend can sit on: list threads in either tree order, spawn a thread in main / an existing worktree or a new one, attach to its terminals, and archive/abandon/merge. Workers launched by `dispatch` and the reconciler are threads too. See [[projects/mlegls-pi/issues/threads-on-zmx-with-a-native-sidebar]] for the model.

decisions:
- 2026-10-01: thread id = its canonical pi session's id at creation; the thread records its current canonical session, updated by a `session_switch` hook on `/new`/`/resume`. Archived is a flag in session-meta.
- 2026-10-01: every terminal of a thread is a zmx session labelled `thread=<id> role=<agent|lg|server|…>` (`zmx set`), so aux terminals survive the window closing, and a zmx session whose thread isn't active is a stray.
- 2026-10-01: merge parent is `branch.<b>.ab-parent=<branch>` in git config, written at spawn (spawning thread's branch) and by drag-to-reparent. git-town keeps the same lineage under `git-town-branch.<b>.parent` and would give `git town sync` along it; not adopted now. Replaces `workmux-base`, which holds a commit, not a merge target.
- 2026-10-01: archive is a post-order walk: archive children, merge the branch into its `ab-parent`, kill the thread's zmx sessions and any process still running in the worktree (as `retire` does), remove the worktree. Guests merge nothing. Abandon is the walk without merges.
- 2026-10-01: a merge conflict mid-archive goes to the conflicting thread's own agent ("rebase onto <parent> and resolve"); the walk resumes on its `done`, and stops at that node, marked in the sidebar, on `blocked`.
- 2026-10-01: one cutover: `lib/wm.ts`'s interface (spawn/send/capture/status/close) over zmx (`run`/`send`/`history`/labels + live records and board reports/`kill`) and the registry; `dispatch`, `integrate`/`retire` and the reconciler move with it; workmux is deleted. Two backends side by side would recreate the strays this removes. Worktree create/remove and the project setup in `.workmux.yaml` move into the registry.
- 2026-10-01: every active thread's pi stays running inside zmx for now; reaping idle unviewed ones is a policy switch, pending [[projects/mlegls-pi/issues/measure-idle-pi-cost]].
- 2026-10-01: exiting the canonical pi restarts it (`pi --session <current>`) rather than ending the thread. Ctrl-C stays, since pi uses it for abort.
- 2026-10-01: in-pi commands live in the workspace extension as `/thread new|fork [--worktree <name>]|promote|archive|abandon|merge`, calling the same CLI as the sidebar. `/thread fork` replaces `/fork-tab` (kept as an alias until tmux is gone). `/workspace <path>` in a canonical pi becomes "fork a new thread there"; in free sessions it's unchanged.
- 2026-10-01: pi 0.99 has no attachable TUI server: stdio RPC (`--mode rpc`) ships; the experimental `PiClient`/CBOR/Unix-socket `RemoteSession` layer is source-only since 0.85 (earendil-works/pi#9132). zmx is the client-server, at the pty layer. If that layer ships, one pi server hosting many sessions replaces a process per thread.
