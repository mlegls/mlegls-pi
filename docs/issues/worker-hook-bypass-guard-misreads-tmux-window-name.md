---
stage: "done"
assignee: "agent"
author: "session:thr_t3ejtyd4wb"
priority: 3
drive: "none"
---
Observed during the Concept joined Application Patch translation first-use worker @thread:thr_t3ejtyd4wb, 2026-10-25. Owning tool/repository: mlegls-pi supervised-worker hook-bypass command guard.

A normal hook-enabled commit launched as a managed tmux window was refused before execution. Command structure: `tmux -L translation-commit-c new-window -t commit -n retry -c "$PWD" 'git commit -m "Record joined Application Patch translation first use"; ...'`. The `-n retry` option names the tmux window; it is not a Git commit option. No Git hook-disabling option or environment setting was supplied.

Refusal: `Workers don't bypass git hooks (commit -n): they are the project's own checks ... Commit normally.` This appears to match tmux's option across the quoted Git command, but the guard implementation was not inspected; that cause is an inference, not established.

Workaround observed: run ordinary `git commit -m ...` directly with a sufficient command timeout. Both commits then passed normal hooks (`e80aa8514`, `feb848dd1` in Concept). The earlier repository diff-size hook refusal was separately resolved by splitting selected facts and the rendered encounter packet into coherent commits, without hook bypass.

Desired outcome: managed tmux launches with normal Git commits remain available, while actual Git hook-disable options are still refused. Scope should be command-aware rather than treating a tmux window-name flag as Git's `commit -n`.

## shape

Cause confirmed by reading [guard/index.ts](../../extensions/guard/index.ts) `hookBypass`: the `commit -n` rule tests the whole segment for `\bgit\b.*\bcommit\b` and then for any short flag cluster containing `n` anywhere in it, so tmux's `-n retry` before the quoted `git commit` matches.

Fix: look for the short `n` flag only in the text after the `commit` word (still with `-m`/`-F` arguments stripped), so `-n` belonging to an outer command before `git` is ignored while `'git commit -n -m x'` inside a tmux/bash -c argument is still refused. Add unit tests for `hookBypass` (a new `extensions/guard/index.test.ts`): the tmux command from this issue passes; `git commit -n`, `git commit -an -m x`, `git commit -m "a -n b"` (passes), `--no-verify` and `-c core.hooksPath=` keep their current verdicts. `drive: none`: the tests are the acceptance.

## Result

done

The fix holds and I changed nothing in the code. Commit `7884bde2` makes `hookBypass` in `extensions/guard/index.ts` look for the `-n` flag only after the `commit` word, so tmux's `-n retry` no longer trips it.

`bun test extensions/guard` passes (1 test, 8 expectations) and `bunx tsc --noEmit` is clean. I also probed some cases outside the test and kept none of them as tests:
- **Still refused:** `git -C /x commit -n -m y`, `git commit -m x -n`, `git commit -nm x` and `git commit --amend -n`.
- **Allowed:** `tmux new-window -c /r/git -n w 'git commit -m x'` and `git log -n 3`.

The branch also carries earlier merged commits from other tickets; I reviewed only the hook-bypass commit.

```yaml
commit: 23b0b95d (evidence index) on top of 7884bde2 (fix)
stories:
  - story: managed tmux launch of a normal git commit is not refused
    outcome: held
  - story: actual hook-disable options (commit -n, --no-verify, core.hooksPath) are still refused
    outcome: held
evidence:
  path: docs/attachments/worker-hook-bypass-guard-misreads-tmux-window-name/index.md
  visual: false
  shots: []
tests:
  - extensions/guard/index.test.ts
caveats:
  - drive was skipped (drive: none); the ticket's unit tests are the acceptance. There is no post-landing gate.
  - An outer command's own `-n` is ignored only when it comes before the `commit` word. The guard still splits on `;` and `&&` even inside quotes, as before this change.
```

Evidence: [docs/attachments/worker-hook-bypass-guard-misreads-tmux-window-name/index.md](../attachments/worker-hook-bypass-guard-misreads-tmux-window-name/index.md)
