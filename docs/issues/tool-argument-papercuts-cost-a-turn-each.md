---
stage: "done"
assignee: "agent"
priority: 3
author: "session:01a1e11e-1e93-773b-9956-3d4ce13ef0d8"
---

# Tool-argument papercuts cost a turn each: edit field aliases, one missing path fails a whole read

Found by the 2026-11-16 efficiency audit (@thread:thr_js85m2wmby, GPT auditor) over concept sessions 11-12 → 11-16: 262 failed tool results of 7,216, each an extra turn (about $5 and two hours of worker wall time).

- `edit` rejects `oldText`/`newText`: 45 failures in 34 threads (Opus 21, Sonnet 19, Fable 5) with `edits.N.new: missing`. The period's session files contain the error text 541 times, counting repeats.
- `read`/`grep` with several paths fail outright when one guessed path doesn't exist: 181 failures in 52 threads (141 on gpt-6.1-sol), 161 of them multi-path calls.
- `issues.ts show` isn't a command (22 failures, all gpt-6.1-sol).

## tasks

1. `lib/outline-read/fragment.ts` / `edit.ts`: accept `oldText` and `newText` as aliases of `old` and `new` in argument preparation.
2. `lib/outline-read/read.ts` and `grep.ts`: a missing path among several reports `not found: <path>` inline and the call returns the rest; a call whose only path is missing still fails.
3. Tracker `issues.ts`: accept `show` as an alias of `text`.
4. Done when: tests cover each alias and a mixed existing/missing multi-path read and grep.

## Result

done

I found no defects in the change, so I made no code repairs. I read commit 43866c6c against the ticket. I ran `bun test lib/outline-read skills/enabled/all/mlegls/conventions/tracker/scripts/issues.test.ts` at the review head: 77 pass, 0 fail.

- **Edit aliases:** the tests cover each of `oldText`/`newText` alone and together, and show the canonical `old`/`new` winning over the aliases.
- **Multi-path read and grep:** the tests cover a mixed existing/missing call and a lone missing path that still fails. A call with several paths where one is missing now returns the rest plus `not found: <path>`. Errors other than missing-path (ENOENT/ENOTDIR) still throw.
- **Tracker:** `show` now behaves as `text`, and the test compares their output.

The desk-related changes in the merged range belong to a different ticket (`desk-writes-delete-attention-items-of-archived-owners`), which has its own review. I only appended my review to the driver's packet and committed it as ee9a9a40.

```yaml
commit: ee9a9a40
stories:
  - story: Fragment edit accepts oldText and newText independently and together through argument preparation.
    outcome: held
  - story: Mixed existing/missing read preserves content and reports the missing path; lone missing read fails.
    outcome: held
  - story: Mixed existing/missing grep preserves matches and reports the missing path; lone missing grep fails.
    outcome: held
  - story: Tracker show aliases text.
    outcome: held
evidence:
  path: docs/attachments/tool-argument-papercuts-cost-a-turn-each/index.md
  visual: false
  shots: []
tests:
  - lib/outline-read/fragment.test.ts
  - lib/outline-read/read.test.ts
  - lib/outline-read/grep.test.ts
  - skills/enabled/all/mlegls/conventions/tracker/scripts/issues.test.ts
filed: []
caveats:
  - Fragment `execute` called directly, without argument preparation, still rejects the aliases. This is the normal pi lifecycle, which always prepares arguments first.
  - The anchor-based edit tool has no alias handling. The ticket named only the fragment edit.
  - The driver did not run the tests; I ran them.
```

Evidence: [docs/attachments/tool-argument-papercuts-cost-a-turn-each/index.md](../attachments/tool-argument-papercuts-cost-a-turn-each/index.md)
