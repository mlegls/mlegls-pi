---
stage: "ticket"
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
