---
stage: done
assignee: agent
author: session:01a0f75a-a8f9-713c-ab66-9c81d8f04a29
---
Done: `ab thread ls` prints exactly one line per thread: multiline `report` and `blocked` reasons are collapsed (newlines → ` ⏎ ` or spaces) and long ones truncated with an ellipsis; `--json` keeps the full text. A test on the row formatter in `lib/thread/cli.ts` (line ~18–22) covers a multiline blocked reason.

During [[projects/mlegls-pi/issues/archive/thread-cli-over-registry]] first use, a blocked archive reason contained a newline and `ab thread ls` printed the continuation as an unindented line, between the child row and the next thread. The blocked marker and reason were correct, but scanning one row per thread became harder. JSON retained the complete reason; using `ls --json` was the workaround.

This is a formatting friction, not a failed blocked-lifecycle claim. Consider rendering multiline report/blocked fields on one line or clearly indenting continuations. Evidence: [CLI packet](../attachments/thread-cli-over-registry/index.md), `commands.json` key `ls-blocked-text`.

## Result

done — I found nothing to repair in the thread-list change.

`ab thread ls` now collapses whitespace in `report` and `blocked` reasons to single spaces and cuts anything over 160 characters with an ellipsis, so each thread prints on one line. This is `summary()` in `lib/thread/cli.ts`. `--json` still returns the full text, and the new test asserts that.

I ran `lib/thread/cli.test.ts` and `lib/board.test.ts`; all 5 tests pass. I didn't re-drive the stories. I read the diff and the driver's evidence packet but did not rerun its replay commands.

The merged-in `lib/board.ts` and `lib/board.test.ts` change (CLI help bypasses validation) is outside this ticket. I didn't review it beyond its tests passing.

```yaml
stories:
  - story: One physical line per thread with collapsed multiline reasons
    outcome: held
  - story: Long report and blocked summaries end in an ellipsis
    outcome: held
  - story: JSON preserves full multiline text
    outcome: held
evidence:
  path: docs/attachments/thread-list-blocked-reason-spills-rows/index.md
  visual: false
  shots: []
tests:
  - lib/thread/cli.test.ts
filed: []
caveats: []
```

Evidence: [docs/attachments/thread-list-blocked-reason-spills-rows/index.md](docs/attachments/thread-list-blocked-reason-spills-rows/index.md)
