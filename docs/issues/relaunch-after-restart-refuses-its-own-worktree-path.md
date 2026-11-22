---
stage: "ticket"
assignee: "agent"
priority: 2
author: "session:thr_vrgtjptnu2"
---
# Relaunch after a restart refuses its own worktree path

After the 2026-11-21 bb daemon restarts, concept reconcilers logged 8 `tick failed: Error: launch <handle>: Worktree path already exists (not owned): /home/mlegls/dev/mmon/concept__worktrees/<handle>` (e.g. `admit-any-file-in-a-session-implement-c`, `bb-sign-in-start-contends-on-one-global-rate-limit-bucket-review-4`, `.git/reconcile/*.log`, 11-21 ~12–13Z). The path is the run's own handle, left by the launch the restart interrupted, so the reconciler can't make progress on that node until someone clears it. Found by the 2026-11-23 efficiency audit (@thread:thr_vrgtjptnu2, Opus auditor @thread:thr_ujfhuerecr).

## tasks

1. On launch, a pre-existing worktree whose branch is this run's handle and which no live worker owns is adopted when its branch has commits beyond the base, else removed and recreated.
2. Anything else at the path still refuses, as now.
3. Done when: a test interrupts a launch after `git worktree add`, restarts the reconciler and gets a worker on that handle.
