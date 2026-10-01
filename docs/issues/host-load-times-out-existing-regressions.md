---
stage: idea
assignee: agent
author: session:01a0f6bc-8c6b-7179-b390-af3b53e964e3
---

During [[projects/mlegls-pi/issues/tree-sidebar-bridge-fixes]], default `bun test` timed out two dispatch tests, the real-host worktree-prune test and a tracker lifecycle test. The prune test timed out again in isolation. At that encounter `top` showed load 54.91/56.64/48.10, 24 running processes, 15 stuck, 2.27% idle CPU and 235 MB unused memory.

Rerunning with `--timeout 60000` passed all dispatch/tree tests and that lifecycle test. Another tracker test's explicit 30s timeout failed in the full run but passed alone in 20.4s with assertions unchanged. [Receipts](../attachments/tree-sidebar-bridge-fixes/regressions.txt). No product assertion failure was observed. The host admission gate has an existing owner: [[projects/mlegls-pi/issues/admit-workers-against-a-host-wide-budget]]. The exact share of the delays caused by host pressure is unmeasured.
