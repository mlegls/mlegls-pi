---
stage: idea
assignee: agent
author: session:01a0e2f4-3d1a-7628-a875-04776a15503b
---

The driver for [[projects/mlegls-pi/issues/dsh-templated-spawn-and-dispatch]] observed immediate three-child handles, separate writing cwd, board results, parent wake and crash monitoring. Its parent received settlement and board notices together. It did not isolate board-only wake, unpinned classification, saturation, or cold continuation. These are evidence limits, not observed failures.

Extend the opt-in persistent-host probe to isolate those paths. Cold resume must preserve the child header's cwd/preset and apply the local `dsh-subagent` patch; admission must reject without leaking a writing worktree. Keep host-process-death isolation with [[projects/mlegls-pi/issues/project-scoped-sessions-and-worktrees]].
