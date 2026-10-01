---
stage: idea
assignee: agent
author: session:01a0f535-86c5-705f-9228-acf119303b56
---

Owner: `lib/session` terminal regression suite. During the socket-cleanup drive
on `71fece2`, `env -u TMUX TMUX_TMPDIR=<fresh-owned-directory> ab check --
bun-axi test lib/session` reported 24 passed and one failure in 12.0 s:
`TmuxTerminalManager > waits for output to change from a previous cursor`,
`expect(received).not.toBe(expected) Expected: not true`, at
`lib/session/tmux.test.ts:92:32`.

The drive used Bun 1.4.2 and tmux 3.7b, after successful documented setup.
Only its own tmux directory was seeded: two stale test-prefix sockets, an
unrelated stale socket, and a live test-prefix sentinel. Socket cleanup held
in the failing run. No source diagnosis or clean-baseline comparison was done;
the receipt does not establish a cause.

The unchanged rerun passed all 25 tests in 4.9 s; this establishes an
intermittent failure, not its cause. The
[drive packet](../attachments/terminal-tests-leak-tmux-sockets/index.md) records
the exact seed and invocation. No product workaround was applied.

Earlier terminal failures have a different recorded symptom:
[[projects/mlegls-pi/issues/archive/session-terminal-regressions-fail-with-extra-shell-sessions]].
Do not assume the same cause.
