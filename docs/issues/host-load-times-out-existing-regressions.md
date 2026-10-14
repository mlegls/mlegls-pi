---
stage: idea
assignee: agent
author: session:01a0f6bc-8c6b-7179-b390-af3b53e964e3
---
During [[projects/mlegls-pi/issues/archive/tree-sidebar-bridge-fixes]], default `bun test` timed out two dispatch tests, the real-host worktree-prune test and a tracker lifecycle test. The prune test timed out again in isolation. At that encounter `top` showed load 54.91/56.64/48.10, 24 running processes, 15 stuck, 2.27% idle CPU and 235 MB unused memory.

Rerunning with `--timeout 60000` passed all dispatch/tree tests and that lifecycle test. Another tracker test's explicit 30s timeout failed in the full run but passed alone in 20.4s with assertions unchanged. [Receipts](../attachments/tree-sidebar-bridge-fixes/regressions.txt). No product assertion failure was observed. The host admission gate has an existing owner: [[projects/mlegls-pi/issues/admit-workers-against-a-host-wide-budget]]. The exact share of the delays caused by host pressure is unmeasured.

Additional encounter during [[projects/mlegls-pi/issues/retry-tests-wait-for-real-backoff]] (2026-10-14, commit 9ceb54f7): default `bun test` ran 224 tests in 213.89s, with 221 pass, 2 skip and one 5s timeout in `lib/thread/lifecycle.test.ts`: `archive conflict answered turn-end is not a resolution: node and ancestor stay active`. The unchanged case passed immediately in isolation in 1.985s via `bun test lib/thread/lifecycle.test.ts -t 'archive conflict answered turn-end'`. No assertion failure observed; host load and the cause of the timeout were not measured. Timings and reproduction: [retry trial packet](../attachments/retry-tests-wait-for-real-backoff/index.md).
