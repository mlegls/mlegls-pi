# Authorized scratch live run

Supervisor authorized disposable repository/local landing, budget 1. Predictions before use: implement/drive/review creates HELLO.md; constraint appears as a bb message; completion tell reaches owner thr_jkk65mgx3y.

Target /private/tmp/bb-coordination-drive.2yWWxv, no remote/services/auth beyond existing bb/pi delegation. Seed commit 6f3a9ab contains one trivial fill ticket and a no-op mise setup. Entry: from scratch cwd, `bun /Users/mlegls/dev/mlegls-pi__worktrees/move-coordination-off-the-board-drive-e/lib/reconcile/main.ts start hello-bb-drive --owner thr_jkk65mgx3y --budget 1 --land local`. CLI returned pid 14583 and its log path.

Observed:
- Status confirms running, local target owned scratch cwd, budget 1, implement worker hello-bb-drive-implement-1.
- bb child thread thr_7d5fywy4nh corresponds to worker internal id 9975cb84-7e69-4c23-b7c4-c4d0f921d99d and owned scratch worktree.
- Worker completed through bb with `done`, commit 2545cdd, committed HELLO.md and CLI entry `git show HEAD:HELLO.md`. Read through `bb thread log thr_7d5fywy4nh --limit 2`; owner also received bb system completion.
- `constrain hello-bb-drive hello-bb-drive 'Verification marker bb-constraint-2yWWxv: preserve exactly Hello bb. with newline; mention this marker in your report.'` returned recorded true/told true. Worker bb history shows the exact marker in `[bb message from thread:thr_jkk65mgx3y]`, not a board post. Constraint arrived just after initial report; waiting for follow-up and chain advancement.
- bb thread wait returned idle. No mocked worker or tests used.

Friction: dispatched worker's initial prompt still names board_send/board_read and decision messages. This may be installed agent-template selection outside scratch setup rather than the branch's changed source; no implementation inspected. This is an observed runtime instruction mismatch, not proof that report delivery used the board.

Run still in progress; cleanup and final owner tell pending.
