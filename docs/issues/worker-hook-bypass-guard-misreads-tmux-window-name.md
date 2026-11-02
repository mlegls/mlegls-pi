---
stage: "ticket"
assignee: "agent"
author: "session:thr_t3ejtyd4wb"
priority: 3
---
Observed during the Concept joined Application Patch translation first-use worker @thread:thr_t3ejtyd4wb, 2026-10-25. Owning tool/repository: mlegls-pi supervised-worker hook-bypass command guard.

A normal hook-enabled commit launched as a managed tmux window was refused before execution. Command structure: `tmux -L translation-commit-c new-window -t commit -n retry -c "$PWD" 'git commit -m "Record joined Application Patch translation first use"; ...'`. The `-n retry` option names the tmux window; it is not a Git commit option. No Git hook-disabling option or environment setting was supplied.

Refusal: `Workers don't bypass git hooks (commit -n): they are the project's own checks ... Commit normally.` This appears to match tmux's option across the quoted Git command, but the guard implementation was not inspected; that cause is an inference, not established.

Workaround observed: run ordinary `git commit -m ...` directly with a sufficient command timeout. Both commits then passed normal hooks (`e80aa8514`, `feb848dd1` in Concept). The earlier repository diff-size hook refusal was separately resolved by splitting selected facts and the rendered encounter packet into coherent commits, without hook bypass.

Desired outcome: managed tmux launches with normal Git commits remain available, while actual Git hook-disable options are still refused. Scope should be command-aware rather than treating a tmux window-name flag as Git's `commit -n`.

## shape

Cause confirmed by reading [guard/index.ts](../../extensions/guard/index.ts) `hookBypass`: the `commit -n` rule tests the whole segment for `\bgit\b.*\bcommit\b` and then for any short flag cluster containing `n` anywhere in it, so tmux's `-n retry` before the quoted `git commit` matches.

Fix: look for the short `n` flag only in the text after the `commit` word (still with `-m`/`-F` arguments stripped), so `-n` belonging to an outer command before `git` is ignored while `'git commit -n -m x'` inside a tmux/bash -c argument is still refused. Add unit tests for `hookBypass` (a new `extensions/guard/index.test.ts`): the tmux command from this issue passes; `git commit -n`, `git commit -an -m x`, `git commit -m "a -n b"` (passes), `--no-verify` and `-c core.hooksPath=` keep their current verdicts. `drive: none`: the tests are the acceptance.
