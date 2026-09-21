---
name: multi-agent
description: "Use when dispatching or coordinating other agents: workers in worktrees, peers in other sessions, or both."
---

Prepared ready waves launch through `dispatch.dispatch` ([contract](../../../../../../docs/dispatch.md)); `realize` supervises the recorded concurrency plan; `route.prepare` interprets fresh assignments and selects stance/model/effort under `routing.md`. `route.continuation` judges continue/consult/replace at exceptions and checkpoints.

two primitives. a _worker_ is a workmux worktree + tmux pane running an agent from `~/.pi/agent/agents/<name>.md`:

```!
bun ~/dev/mlegls-pi/lib/wm.ts agents
```

a _channel_ is a board topic; topics are paths, messages carry tags, subscriptions are topic glob × tag expression (`done | (blocked & !retry)`), with or without wake. every worker gets `_common.md`: report on `<run>/<handle>` with `done` / `blocked` / `needs-input`, coordinate with `<run>/*` peers by reading or subscribing, mark cross-cutting choices `decision` + `path:<file>`.

tree: through exec's namespaces, `wm.spawn` (several workers per call; `wait:true` blocks until all report, like subagents), `wm.wait` (`any|all` over any set of handles, in-turn), and `wm`'s `send`, `capture`, `merge`, `close`, and `status`. `wm.spawn` also subscribes you with wake to the terminal tags for what lands outside a wait, and `close` unsubscribes. from a script, `~/dev/mlegls-pi/lib/wm.ts` (lib or `bun wm.ts …`), where `w.done` / `w.events` / `wait([a,b], {mode})` are the wake. a worker may spawn its own under `<run>/<handle>/…`; supervision is per subtree, so restart the subtree whose context went bad, not the run. `merge(w)` is plain git; a `MergeConflict` goes back to the worker via `send`.

mesh: any sessions, including two interactive ones you're running, `board.subscribe` a shared topic (or each other's) and `board.send` decisions there; `board.read` before touching a seam; wake only for what should interrupt a turn.

after handling fetched reports, `await board.ack(ids)`.

inside Orca (`ORCA_WORKTREE_ID` / `ORCA_WORKSPACE_ID`): use `dispatch.dispatch` for nested worktree workers, `board` for reports and steering, and Orca’s terminal CLI for inspection. Subscribe to `<run>/*` before launch; retain all outstanding handles in the dispatch budget. Review/merge with Git or Orca, then remove the worktree. See [Orca integration](../../../../../../docs/orca.md).

`orchestrate` for auftragstaktik over open inputs, `compile` for preparing hermetic fills over closed ones; mixed waves and standalone fills are normal. `session` is a separate tmux server: it can't see worker panes; `capture`/`send` can.

be mindful of context windows. size tasks such that all context accumulated within the task is relevant, and spawn new sessions whenever the old context wouldn't be relevant to the new task. you can ask old sessions for a handoff (essentially a compaction) if appropriate.

remember to prune the subagents and branches you spawn as they're no longer needed. open sessions especially take up a lot of memory.
