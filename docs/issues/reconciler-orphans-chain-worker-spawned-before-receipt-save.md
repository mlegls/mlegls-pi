---
stage: "idea"
assignee: "agent"
author: "session:review7"
---
A reconciler that crashes between a chain worker's spawn and the save of its receipt leaves a live bb thread titled `<run>/<handle>` that run state doesn't name. On restart `if (!c.handle) startPhase(...)` (lib/reconcile/reconcile.ts, chain loop) launches a fresh handle from `nextHandle`, so the first worker keeps running its worktree beside the second until `reconcile stop` retires it by title.

Found while reviewing [[projects/mlegls-pi/issues/key-workers-by-bb-thread-id]]: recovery by bb title is wired only for refinement writers, PR repair launches and `stop` (each observed live in [the packet](../attachments/key-workers-by-bb-thread-id/index.md)); the chain's own implement/drive/review handle is not among them. Read from code, not reproduced live; the same gap existed with registry lookups before that ticket.

Open choice: adopt the titled thread for the chain's saved handle name (nextHandle is saved before launch, so the name is knowable), or retire it before relaunching.
