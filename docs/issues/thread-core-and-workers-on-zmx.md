---
stage: spec
assignee: agent
author: session:01a0f69a-dbcb-7684-87de-422739d2c54e
part-of: "[[projects/mlegls-pi/issues/thread-registry-on-zmx]]"
priority: 2
---

Session mode: hacking. Build `lib/thread/` and the `ab thread` CLI from [[projects/mlegls-pi/issues/thread-registry-on-zmx]] (its decisions and interface are the contract), and move workers onto it.

- `lib/wm.ts`'s `Worker` over threads: status from live records (`lib/session-meta/live.ts`) and board reports; exited when the zmx session or the pi pid is gone; capture via `zmx history`; send via `zmx send` (no automatic `\r`); close via abandon, keeping the branch when asked.
- `dispatch`, `integrate`/`retire`, `lib/children.ts`, `lib/session/jump.ts` and the reconciler move with it. integrate merges into the worker thread's `ab-parent`, which at spawn is the dispatcher's branch, so behavior is unchanged.
- `mise.toml` with a `setup` task replacing `.workmux.yaml`'s `post_create`.
- zmx is a mise dependency (`mise use zmx`).

First use: from a pi in this checkout, `tools.dispatch` a trivial worker, see it report on the board, `integrate` it, and check that `zmx ls` and `ab thread ls` show nothing left. Then archive a two-level thread tree with a deliberate conflict in the child and see the conflict go to the child's agent.

Workmux stays installed until [[projects/mlegls-pi/issues/delete-workmux-and-tmux-paths]], but nothing new uses it.
