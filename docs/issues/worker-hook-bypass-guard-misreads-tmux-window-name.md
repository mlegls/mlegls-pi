---
stage: "idea"
assignee: "agent"
author: "session:thr_t3ejtyd4wb"
---
Observed during the Concept joined Application Patch translation first-use worker @thread:thr_t3ejtyd4wb, 2026-10-25. Owning tool/repository: mlegls-pi supervised-worker hook-bypass command guard.

A normal hook-enabled commit launched as a managed tmux window was refused before execution. Command structure: `tmux -L translation-commit-c new-window -t commit -n retry -c "$PWD" 'git commit -m "Record joined Application Patch translation first use"; ...'`. The `-n retry` option names the tmux window; it is not a Git commit option. No Git hook-disabling option or environment setting was supplied.

Refusal: `Workers don't bypass git hooks (commit -n): they are the project's own checks ... Commit normally.` This appears to match tmux's option across the quoted Git command, but the guard implementation was not inspected; that cause is an inference, not established.

Workaround observed: run ordinary `git commit -m ...` directly with a sufficient command timeout. Both commits then passed normal hooks (`e80aa8514`, `feb848dd1` in Concept). The earlier repository diff-size hook refusal was separately resolved by splitting selected facts and the rendered encounter packet into coherent commits, without hook bypass.

Desired outcome: managed tmux launches with normal Git commits remain available, while actual Git hook-disable options are still refused. Scope should be command-aware rather than treating a tmux window-name flag as Git's `commit -n`.
