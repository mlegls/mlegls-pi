---
stage: "ticket"
assignee: "agent"
author: "session:review7"
priority: 3
---
A reconciler that crashes between a chain worker's spawn and the save of its receipt leaves a live bb thread titled `<run>/<handle>` that run state doesn't name. On restart `if (!c.handle) startPhase(...)` (lib/reconcile/reconcile.ts, chain loop) launches a fresh handle from `nextHandle`, so the first worker keeps running its worktree beside the second until `reconcile stop` retires it by title.

Found while reviewing [[projects/mlegls-pi/issues/key-workers-by-bb-thread-id]]: recovery by bb title is wired only for refinement writers, PR repair launches and `stop` (each observed live in [the packet](../attachments/key-workers-by-bb-thread-id/index.md)); the chain's own implement/drive/review handle is not among them. Read from code, not reproduced live; the same gap existed with registry lookups before that ticket.

Open choice: adopt the titled thread for the chain's saved handle name (nextHandle is saved before launch, so the name is knowable), or retire it before relaunching.

## shape

Adopt, following the PR-repair launch in [reconcile.ts](../../lib/reconcile/reconcile.ts) (`receipt.launchHandle` saved from `nextHandle`, then `findWorker({ run, handle })` before `launchNow`):

- `startPhase` saves the chain's intended handle name (e.g. `c.launching`) before calling `launch`, and clears it once `c.handle` is saved.
- the chain loop's `if (!c.handle)` branch first checks `c.launching`: if `findWorker` finds a live bb thread for that run/handle, set `c.handle` to it (with `launchedAt` now) and carry on as if the launch returned; otherwise launch under that same saved name rather than a fresh `nextHandle`.
- a test in `lib/reconcile/` with the existing fake worker backend: a chain whose saved state has `launching` and no `handle`, with a registered worker of that name, adopts it and launches nothing; with none registered, launches exactly one worker under that name.

decisions:
- 2026-11-02: adopt the titled thread rather than retire and relaunch: the name is known before launch, and adoption keeps the work already started (@thread:thr_dwre28wvm6).
