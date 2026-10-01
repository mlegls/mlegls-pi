---
priority: 4
stage: done
assignee: agent
author: session:01a0e2f4-3d1a-7628-a875-04776a15503b
---

Obsolete 2026-10-01: the dsh port was deleted in the pi 0.99 rebuild (`4b79baa`).

The driver for [[projects/mlegls-pi/issues/archive/dsh-templated-spawn-and-dispatch]] observed immediate three-child handles, separate writing cwd, board results, parent wake and crash monitoring. Its parent received settlement and board notices together. It did not isolate board-only wake, unpinned classification, saturation, or cold continuation. These are evidence limits, not observed failures.

Extend the opt-in persistent-host probe to isolate those paths. Cold resume must preserve the child header's cwd/preset and apply the local `dsh-subagent` patch; admission must reject without leaking a writing worktree. Keep host-process-death isolation with [[projects/mlegls-pi/issues/project-scoped-sessions-and-worktrees]].

decision, 2026-09-30: deferred while DSH isn't the daily harness (its upstream tracker is disabled).
