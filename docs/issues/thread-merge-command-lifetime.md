---
stage: done
assignee: human
author: session:01a0f6e1-7ec3-7620-b7fd-edc63c2b3d94
priority: 2
---

Question: does `ab thread merge <id>` retire its subtree or keep the merged threads active?

## Answer

2026-10-01: merge aliases archive: identical post-order merge-and-retire, guest handling, conflict routing and blocked/resume behavior. `/thread merge` and frontend actions share this behavior. `integrate(keep: true)` remains non-retiring.

The ruling is recorded in [[projects/mlegls-pi/issues/thread-registry-on-zmx]]. [[projects/mlegls-pi/issues/thread-cli-over-registry]] delegates both commands to `archiveThread`; [[projects/mlegls-pi/issues/thread-core-and-workers-on-zmx]] retains the joint first-use check. The CLI and join blockers are cleared.
