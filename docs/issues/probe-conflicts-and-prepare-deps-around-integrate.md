---
stage: ticket
assignee: agent
priority: 3
author: session:01a0e5e9-67b7-732e-90ce-7e6ac7a4ad76
part-of: "[[projects/mlegls-pi/issues/reconcile-the-execution-tree-with-lazy-exception-handlers]]"
blocked-by: ["[[projects/mlegls-pi/issues/stopped-supervise-jobs-have-no-cleanup-path]]"]
---

Carried to the reconciler 2026-10-01: `land()` in `lib/reconcile/reconcile.ts` sends a conflict's file list back to the child but doesn't probe before integrating, name the target's commits per file, or prepare dependencies after a rebase. The `resume … integrate` paragraph below is moot: a failed decomposition is an exception a handler retries.

Owner: `ab supervise` integrate. Most Concept integrate failures on 2026-09-29 were mechanical. Some were conflicts from stale bases (up to 525 commits behind main), which the loop reported only as `MergeConflict: <file>`. Others were TS2307 `std-semver` after a rebase, because the worktree's dependencies predated a new package; that happened four times, each fixed by `mise run deps`.

Fix: before integrating, run `git merge-tree --write-tree --name-only <target> <head>`. On conflict, send the child the file list and the target's commits touching each file, not a bare failure to the owner. After the integration rebase, run the repository's dependency preparation (`mise run deps` here) before `--test`. This relates to the existing report-only item about running setup when a worktree is created.

After a decomposition fails to integrate, `resume … integrate` takes the normal path and fails with "an accepted review of the current head is required". The only retry is a child turn end, so the owner has to steer the child to re-report. `resume … integrate` should retry `decompose` for a child that decomposed.

ticket contract, 2026-09-30: as the body proposes: probe with `git merge-tree` before integrating and send a conflict to the child with the file list and the target's commits touching each file; after an integration rebase that changes the lockfile, run the repository's dependency setup before checks.
