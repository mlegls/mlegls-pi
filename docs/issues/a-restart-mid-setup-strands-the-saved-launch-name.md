---
stage: "idea"
assignee: "agent"
author: "session:thr_ihbpyrp6s2"
priority: 2
---

A reconciler that restarts while a launch is inside `newThread`'s setup (worktree and branch made, `runSetup` still running, no bb thread yet) leaves that worktree and branch behind: the catch-block cleanup in [runtime.ts](../../lib/thread/runtime.ts) never runs because the process is gone. The run then relaunches under the same saved name ([[projects/mlegls-pi/issues/reconciler-orphans-chain-worker-spawned-before-receipt-save]] chose that), and `newThread` refuses it on every tick: "Worktree path already exists (not owned)", retrying every 5 s forever.

Seen three times in Concept on 2026-11-21 between 20:21 and 20:27 Shanghai (file-the-building-a-company-first-use-defects-review-u, benchmark-cost-per-turn-of-frontier-managed-models-drive-4, admit-any-file-in-a-session-implement-c), each after "code changed on disk; restarting" while setup waited in the heavy queue under load ~40. Each leftover was clean, at its launch base, with no thread or process; the supervisor removed worktree and branch by hand, and benchmark's drive-4 recurred once after one such removal.

Restarts on code change make this common: setup can wait minutes for a heavy slot, and any mlegls-pi commit restarts every reconciler.

Possible shape: when the saved launch name's worktree exists, has no bb thread (`bbWorkerThread`), and is clean at a commit the launch base contains, reclaim it (remove worktree and branch, then launch); otherwise escalate once to the owner instead of retrying every 5 s. Or defer restart-on-code-change while a launch is in setup.
