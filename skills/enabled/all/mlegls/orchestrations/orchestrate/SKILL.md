---
name: orchestrate
description: "Use to run a session-sized skill (e.g. `implement`, `verify-story`, `simplify`) over a bigger scope than is appropriate for a self-contained session."
argument-hint: "the inner skill and its scope: a spec with tickets, a story tree, or a partitioned simplify scope"
---

carry the agreed scope through to completion; bring back choices that change it.

1. find embarrassingly parallelizable session-sized units of work.
2. choose each unit's executor through `dispatch`; spawn open units as `auto`. use `wm.spawn` (one call for the batch); an `auto` child runs `dispatch` on its unit; they're interactive pi sessions in worktrees, reporting on the board at `<run>/<handle>`. for almost embarrassingly parallel work, workers coordinate through their topics (`decision` + `path:` tags) or through you. prompt by auftragstaktik, specifying desiderata only to the extent necessary for coordination without churn
3. join serially: `wm.wait` mode `any` over the batch, or let `done` wake you; on `checkpoint`, continue or respawn from the ticket. `wm.merge`; on conflicts, `wm.send` the worker its conflict list to resolve on its branch; update tracked work, and clean up worktrees as chunks are completed (rather than all at once after the whole spec).
4. after joining, compare the result with the original destination. finish remaining work within the agreed scope, then resolve the issue; if blocked, name the exact unresolved claim and what resolves it.

workers and the board: `multi-agent`.
