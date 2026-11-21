---
stage: "done"
assignee: "agent:auto-routine"
author: "session:thr_ihbpyrp6s2"
priority: 1
---

A reconciler that restarts while a launch is inside `newThread`'s setup (worktree and branch made, `runSetup` still running, no bb thread yet) leaves that worktree and branch behind: the catch-block cleanup in [runtime.ts](../../lib/thread/runtime.ts) never runs because the process is gone. The run then relaunches under the same saved name ([[projects/mlegls-pi/issues/reconciler-orphans-chain-worker-spawned-before-receipt-save]] chose that), and `newThread` refuses it on every tick: "Worktree path already exists (not owned)", retrying every 5 s forever.

Seen three times in Concept on 2026-11-21 between 20:21 and 20:27 Shanghai (file-the-building-a-company-first-use-defects-review-u, benchmark-cost-per-turn-of-frontier-managed-models-drive-4, admit-any-file-in-a-session-implement-c), each after "code changed on disk; restarting" while setup waited in the heavy queue under load ~40. Each leftover was clean, at its launch base, with no thread or process; the supervisor removed worktree and branch by hand, and benchmark's drive-4 recurred once after one such removal.

Restarts on code change make this common: setup can wait minutes for a heavy slot, and any mlegls-pi commit restarts every reconciler.

Possible shape: when the saved launch name's worktree exists, has no bb thread (`bbWorkerThread`), and is clean at a commit the launch base contains, reclaim it (remove worktree and branch, then launch); otherwise escalate once to the owner instead of retrying every 5 s. Or defer restart-on-code-change while a launch is in setup.

## Result

done — rebased onto `8f137854`. The conflict resolution preserves both saved-name recovery and phase-scoped constraints for PR repair workers. Both replays held, all six affected checks passed, and the worktree is clean.

```yaml
commit: 11283098
stories:
  - story: Resume the saved launch after interrupted setup leaves a clean checkout
    outcome: held
  - story: Hold an occupied saved name for the owner when there are local changes
    outcome: held
evidence:
  path: docs/attachments/a-restart-mid-setup-strands-the-saved-launch-name/index.md
  visual: false
  shots: []
fixed:
  - Removed forced worktree deletion so Git rechecks for local changes at removal time.
tests: []
filed: []
caveats:
  - The replays seed the restart aftermath and use fake BB; live interruption and owner mail delivery were not exercised.
  - A failed sibling visit waits for the slowest in-flight sibling before retrying; a setup queued for minutes can delay retry by those minutes.
```

Evidence: [docs/attachments/a-restart-mid-setup-strands-the-saved-launch-name/index.md](../attachments/a-restart-mid-setup-strands-the-saved-launch-name/index.md)
