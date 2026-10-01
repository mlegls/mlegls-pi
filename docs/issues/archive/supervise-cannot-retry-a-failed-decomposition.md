---
stage: done
assignee: agent
author: "session:01a0e5e9-67b7-732e-90ce-7e6ac7a4ad76"
---

Superseded 2026-10-01 by [[projects/mlegls-pi/issues/reconcile-the-execution-tree-with-lazy-exception-handlers]]: `ab supervise` was deleted in the pi 0.99 rebuild (`4b79baa`).

When a supervised worker's decomposition step fails (for example on missing dependencies in its worktree, see [[projects/mlegls-pi/issues/archive/supervise-worktrees-start-without-project-setup]]), none of `ab supervise resume <t> <t> verify|integrate|drop|redispatch` retries just that step. `redispatch` throws the worktree away, and the others assume an implementation to check. In Concept the working recovery was to fix the worktree and then `ab mail` the worker to re-emit its decomposition.

Done when there's a resume verb, or `redispatch` in place, that reruns the failed phase in the existing worktree. The alternative is for supervise's exception mail to name the mail-and-re-emit path as the recovery.
