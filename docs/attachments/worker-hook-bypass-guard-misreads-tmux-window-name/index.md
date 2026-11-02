# Hook-bypass guard vs tmux window name: review

Drive skipped (`drive: none`); the ticket's unit tests are the acceptance. Nonvisual.

Change: 7884bde2 `hookBypass` (extensions/guard/index.ts) now looks for commit's short `n` flag only in the text after the `commit` word, still with `-m`/`-F` arguments stripped.

## Evidence

- `bun test extensions/guard`: 1 test, 8 expectations pass. Cases: the tmux command from the issue passes; `git commit -n`, `git commit -an -m x`, tmux/bash -c wrapping `git commit -n -m x`, `--no-verify` and `-c core.hooksPath=` are refused; `git commit -m "a -n b"` passes.
- Extra probes by the reviewer (not kept as tests): `git -C /x commit -n -m y`, `git commit -m x -n`, `git commit -nm x`, `git commit --amend -n` refused; `tmux new-window -c /r/git -n w 'git commit -m x'`, `git log -n 3`, `cd x && git commit -m y` pass.
- `bunx tsc --noEmit` clean.

## Story outcomes

| Story | Outcome |
| --- | --- |
| Managed tmux launch of a normal git commit is not refused | held |
| Actual hook-disable options are still refused | held |
