---
stage: "ticket"
assignee: "agent"
priority: 2
author: "session:01a16efb-a47f-743e-b4b9-98781099fb47"
---
Seen twice on the concept Beelink checkout, 2026-10-25 (drive-and-review-planning-goal-corpus-refine-1 at 04:58 UTC, replay-recovered-tool-errors-from-recordings-drive-2 about 05:20): a reconciler launch fails with `Worker setup failed: 1 (see <worktree>/.wm/setup.log)` followed by `Partial resources cleaned`, and the cleanup removes the worktree, so the named setup.log no longer exists. Both succeeded on a plain retry, so the cause (likely contention while 6+ workers run mise run setup with local Convex deployments at once) is unknown.

Want: on a failed setup, keep the log: copy .wm/setup.log (tail is enough) into the reconcile log or a retained path such as .git/reconcile/setup-failures/<worker>.log before removing the worktree, and name that path in the exception text.
