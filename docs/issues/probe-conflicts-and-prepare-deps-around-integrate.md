---
stage: idea
assignee: agent
author: session:01a0e5e9-67b7-732e-90ce-7e6ac7a4ad76
---

Owner: `ab supervise` integrate. Most Concept integrate failures on 2026-09-29 were mechanical. Some were conflicts from stale bases (up to 525 commits behind main), which the loop reported only as `MergeConflict: <file>`. Others were TS2307 `std-semver` after a rebase, because the worktree's dependencies predated a new package; that happened four times, each fixed by `mise run deps`.

Fix: before integrating, run `git merge-tree --write-tree --name-only <target> <head>`. On conflict, send the child the file list and the target's commits touching each file, not a bare failure to the owner. After the integration rebase, run the repository's dependency preparation (`mise run deps` here) before `--test`. This relates to the existing report-only item about running setup when a worktree is created.

After a decomposition fails to integrate, `resume … integrate` takes the normal path and fails with "an accepted review of the current head is required". The only retry is a child turn end, so the owner has to steer the child to re-report. `resume … integrate` should retry `decompose` for a child that decomposed.
