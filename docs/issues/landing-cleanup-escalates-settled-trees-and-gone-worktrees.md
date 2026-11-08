---
stage: "ticket"
assignee: "agent"
priority: 3
author: "thread:thr_5aa27tkct7"
---
Landing cleanup escalates to the supervisor for causes the reconciler can settle itself. Found by the efficiency audit of 2026-11-09 (@thread:thr_5aa27tkct7) in the Concept supervisor @thread:thr_ihbpyrp6s2: 7 "landing cleanup failed 3 times" exceptions between 11-05 and 11-07, each answered by hand (`rm -rf` and a retry).

Two causes, both after the landing's commits were already in the target:

- **A collector `--tree` worktree holding only untracked hook state.** `git -C ~/dev/mmon/concept worktree remove …/<root>--tree` refused: "contains modified or untracked files, use --force" (5 cases: version-theories-like-packages, attach-free-sessions-through-lesson-confirmations, build-the-mission-itinerary-with-continue-skip-revise, store-mission-runs-and-show-continue-skip-revise, progress-through-a-mission-along-its-lesson-order). The untracked file was `.husky/_/`; Concept stopped creating it in new trees at b9ef2098b (11-05 19:47), but trees made earlier kept failing until 11-06.
- **A worker worktree that is already deregistered or gone.** `git -C …/batch-srs-card-creation-in-one-accepted-call-implement-3 rev-parse --show-toplevel` failed with "not a git repository" (2 cases, 11-07 08:55 and 08:57).

In `cleanupLandings` ([reconcile.ts](../../lib/reconcile/reconcile.ts)):

- When every commit of a collector tree is already in the target (`git cherry` empty) and its only changes are untracked or ignored, remove it with `--force` (moving ignored state as other retirements do), rather than raising an exception.
- Treat a worker worktree that git no longer lists, or whose directory is gone, as already cleaned up: prune its registration and finish the landing's cleanup.
- Keep escalating anything else (tracked modifications, unmerged commits).

Done when a test covers both cases, each finishing cleanup without an exception, and a tree with an unmerged commit still escalates.
