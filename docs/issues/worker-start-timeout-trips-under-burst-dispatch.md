---
stage: idea
assignee: agent
priority: 3
author: session:01a0f065-abaf-776c-bc8b-419cb9b312e4
---

On 2026-09-30 a tend session started 15 `ab supervise start` jobs back to back. One (`ab-jg-can-stall-without-output-during-semantic-discovery`) woke its owner with `worker did not start within 30s (no pi session found)`, although its worktree and tmux window existed; `resume … redispatch` then started it normally. The 30s start deadline from [[projects/mlegls-pi/issues/supervise-detects-unstarted-workers]] looks too tight when many workers launch at once. Options: scale the deadline with concurrent launches, or check the window/pane before calling the worker unstarted.
