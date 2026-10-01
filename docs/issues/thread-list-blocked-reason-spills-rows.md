---
stage: idea
assignee: agent
author: session:01a0f75a-a8f9-713c-ab66-9c81d8f04a29
---

During [[projects/mlegls-pi/issues/thread-cli-over-registry]] first use, a blocked archive reason contained a newline and `ab thread ls` printed the continuation as an unindented line, between the child row and the next thread. The blocked marker and reason were correct, but scanning one row per thread became harder. JSON retained the complete reason; using `ls --json` was the workaround.

This is a formatting friction, not a failed blocked-lifecycle claim. Consider rendering multiline report/blocked fields on one line or clearly indenting continuations. Evidence: [CLI packet](../attachments/thread-cli-over-registry/index.md), `commands.json` key `ls-blocked-text`.
