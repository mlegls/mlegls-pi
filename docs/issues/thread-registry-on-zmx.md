---
stage: spec
assignee: agent
author: session:01a0f69a-dbcb-7684-87de-422739d2c54e
part-of: "[[projects/mlegls-pi/issues/threads-on-zmx-with-a-native-sidebar]]"
priority: 2
---

A CLI (under `ab`) for threads over zmx that any frontend can sit on: list threads in either tree order, spawn a thread in main / an existing worktree or a new one, attach to its terminals, and archive/abandon/merge. Workers launched by `dispatch` and the reconciler are threads too. See [[projects/mlegls-pi/issues/threads-on-zmx-with-a-native-sidebar]] for the model.

decisions:
- 2026-10-01: thread id = its canonical pi session's id at creation. Thread records live in `~/.local/state/ab-threads/<id>.json`: current canonical session, cwd, worktree, owner or guest, parent thread, archived. Not session-meta, because the CLI writes them while pi may be appending to the session file; session-meta carries `thread=<id>` so `graph.ts` can join. A `session_switch` hook moves the current session on `/new`/`/resume`.
- 2026-10-01: every terminal of a thread is a zmx session labelled `thread=<id> role=<agent|lg|server|…>` (`zmx set`), so aux terminals survive the window closing, and a zmx session whose thread isn't active is a stray.
- 2026-10-01: merge parent is `branch.<b>.ab-parent=<branch>` in git config, written at spawn (spawning thread's branch) and by drag-to-reparent. git-town keeps the same lineage under `git-town-branch.<b>.parent` and would give `git town sync` along it; not adopted now. Replaces `workmux-base`, which holds a commit, not a merge target.
- 2026-10-01: archive is a post-order walk: archive children, merge the branch into its `ab-parent`, kill the thread's zmx sessions and any process still running in the worktree (as `retire` does), remove the worktree. Guests merge nothing. Abandon is the walk without merges.
- 2026-10-01: `ab thread merge <id>` aliases `archive <id>`: the same post-order merge-and-retire walk, guest handling, conflict routing and blocked/resume behavior. It does not leave merged threads active. This follows the enclosing model's nested-transaction commit/abort lifecycle; a separate merge-only CLI lifetime is not part of this cutover. `/thread merge` and frontend merge actions use the same alias. Supervision `integrate(keep: true)` remains the distinct non-retiring integration primitive.
- 2026-10-01: a merge conflict mid-archive goes to the conflicting thread's own agent ("rebase onto <parent> and resolve"); the walk resumes on its `done`, and stops at that node, marked in the sidebar, on `blocked`.
- 2026-10-01: one cutover: `lib/wm.ts`'s interface (spawn/send/capture/status/close) over zmx (`run`/`send`/`history`/labels + live records and board reports/`kill`) and the registry; `dispatch`, `integrate`/`retire` and the reconciler move with it; workmux is deleted. Two backends side by side would recreate the strays this removes. Worktree create/remove moves into the registry; creating a worktree runs `mise run setup` when the project defines that task, else nothing (this repo moves `bun run setup` from `.workmux.yaml` into it). Existing workmux worktrees and tmux sessions drain under the old path before the deletion ticket; `promote` covers any to keep. No `adopt`.
- 2026-10-01: every active thread's pi stays running inside zmx for now; reaping idle unviewed ones is a policy switch, pending [[projects/mlegls-pi/issues/measure-idle-pi-cost]].
- 2026-10-01: `<id>.agent` runs a loop that execs `pi --session <current>`, so exiting the canonical pi restarts it (`pi --session <current>`) rather than ending the thread. Ctrl-C stays, since pi uses it for abort.
- 2026-10-01: in-pi commands live in the workspace extension as `/thread new|fork [--worktree <name>]|promote|archive|abandon|merge`, calling the same CLI as the sidebar. `/thread fork` replaces `/fork-tab` (kept as an alias until tmux is gone). `/workspace <path>` in a canonical pi becomes "fork a new thread there"; in free sessions it's unchanged.
- 2026-10-01: pi 0.99 has no attachable TUI server: stdio RPC (`--mode rpc`) ships; the experimental `PiClient`/CBOR/Unix-socket `RemoteSession` layer is source-only since 0.85 (earendil-works/pi#9132). zmx is the client-server, at the pty layer. If that layer ships, one pi server hosting many sessions replaces a process per thread.
- 2026-10-01: until [[projects/mlegls-pi/issues/native-thread-sidebar-in-a-ghostty-fork]], the window is the TUI sidebar split plus one main split attached to the selected thread's `.agent`. Switching threads uses zmx's own switch: `ZMX_SESSION=<shown> zmx attach <target>` makes the pane showing `<shown>` switch (`handleSwitch` in zmx's `loop.zig`). Aux terminals aren't handled before the native app; plain Ghostty splits/tabs are enough. The tmux popup dashboard goes.
- 2026-10-01: zmx labels live only as long as the session, so they're for discovery; thread state that outlives a process is in the thread records.

interface (fixed before the children start):

```
ab thread ls [--tree spawn|merge] [--json]
ab thread new  [--in <cwd>|--worktree <name> [--base <ref>]] [--parent <thread>] [--prompt …] [--cmd …]
ab thread fork [--worktree <name>]            # from PI_SESSION_ID
ab thread promote [<session>]
ab thread attach <id> [--role agent|…]        # zmx attach <id>.<role>, created in the thread's cwd if missing
ab thread send|history <id>                   # zmx send / history on <id>.agent
ab thread archive|abandon|merge <id>          # post-order walk
```

zmx sessions `<id>.<role>`, labelled `thread=<id> role=<role>`. Merge parent `branch.<b>.ab-parent`.

Story: [[projects/mlegls-pi/stories/work-in-threads]].
