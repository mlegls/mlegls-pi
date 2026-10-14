---
stage: ticket
assignee: agent
author: session:01a0f75a-a8f9-713c-ab66-9c81d8f04a29
---
Done: `ab thread ls` prints exactly one line per thread: multiline `report` and `blocked` reasons are collapsed (newlines → ` ⏎ ` or spaces) and long ones truncated with an ellipsis; `--json` keeps the full text. A test on the row formatter in `lib/thread/cli.ts` (line ~18–22) covers a multiline blocked reason.

During [[projects/mlegls-pi/issues/thread-cli-over-registry]] first use, a blocked archive reason contained a newline and `ab thread ls` printed the continuation as an unindented line, between the child row and the next thread. The blocked marker and reason were correct, but scanning one row per thread became harder. JSON retained the complete reason; using `ls --json` was the workaround.

This is a formatting friction, not a failed blocked-lifecycle claim. Consider rendering multiline report/blocked fields on one line or clearly indenting continuations. Evidence: [CLI packet](../attachments/thread-cli-over-registry/index.md), `commands.json` key `ls-blocked-text`.
