---
name: multi-agent
description: "Use when dispatching or coordinating other agents: workers in worktrees, peers in other sessions, or both."
---

Prepared ready waves launch through `dispatch.dispatch` ([contract](../../../../../../docs/dispatch.md)); `realize` owns the concurrency plan and `route.route` selects model/effort.

two primitives. a _worker_ is a workmux worktree + tmux pane running an agent from `~/.pi/agent/agents/<name>.md`:

```!
bun ~/dev/mlegls-pi/lib/wm.ts agents
```

a _channel_ is a board topic; topics are paths, messages carry tags, subscriptions are topic glob × tag expression (`done | (blocked & !retry)`), with or without wake. every worker gets `_common.md`: report on `<run>/<handle>` with `done` / `blocked` / `needs-input`, coordinate with `<run>/*` peers by reading or subscribing, mark cross-cutting choices `decision` + `path:<file>`.

tree: through exec's namespaces, `wm.spawn` (several workers per call; `wait:true` blocks until all report, like subagents), `wm.wait` (`any|all` over any set of handles, in-turn), and `wm`'s `send`, `capture`, `merge`, `close`, and `status`. `wm.spawn` also subscribes you with wake to the terminal tags for what lands outside a wait, and `close` unsubscribes. from a script, `~/dev/mlegls-pi/lib/wm.ts` (lib or `bun wm.ts …`), where `w.done` / `w.events` / `wait([a,b], {mode})` are the wake. a worker may spawn its own under `<run>/<handle>/…`; supervision is per subtree, so restart the subtree whose context went bad, not the run. `merge(w)` is plain git; a `MergeConflict` goes back to the worker via `send`.

mesh: any sessions, including two interactive ones you're running, `board.subscribe` a shared topic (or each other's) and `board.send` decisions there; `board.read` before touching a seam; wake only for what should interrupt a turn.

after handling fetched reports, `await board.ack(ids)`.

inside bb (`BB_THREAD_ID` set): `wm` and `board` are absent and bb's thread tree is the mesh, via `sh`. worker = `bb thread spawn --parent "$BB_THREAD_ID" --new-environment worktree --prompt-file - --json` (prompt on stdin; `--provider pi`, model/reasoning from `bb provider models pi --json`); the parent is woken when a child idles. `bb thread wait <id>` blocks on idle, `bb thread output <id>` is the report, `bb thread show <id> --git-diff` the change, `bb thread tell <id> "…"` steers (`--mode queue` to not interrupt); a worker reports by ending its turn and reaches the parent with `bb thread tell`. merge is still plain git in the parent. `multi-agent`'s tags (`done`/`blocked`/`needs-input`) go in the first line of the final output. archive the thread when merged; the worktree follows.

`orchestrate` for auftragstaktik over open inputs, `compile` for hermetic fills over closed ones. `session` is a separate tmux server: it can't see worker panes; `capture`/`send` can.

be mindful of context windows. size tasks such that all context accumulated within the task is relevant, and spawn new sessions whenever the old context wouldn't be relevant to the new task. you can ask old sessions for a handoff (essentially a compaction) if appropriate.

remember to prune the subagents and branches you spawn as they're no longer needed. open sessions especially take up a lot of memory.
