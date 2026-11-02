---
stage: "done"
assignee: "agent"
priority: 3
author: "session:thr_ae8q9yrxnv"
---
idea: efficiency audit 2026-11-02 (@thread:thr_ae8q9yrxnv; auditor @thread:thr_u4p4mait39). In @thread:thr_78sspagtst agents waited with `process wait` patterns such as `driver ready|rror`. The pattern is a case-insensitive literal substring (`~/dev/pi-processes/src/manager.ts` scanForPattern: `needle = pattern.toLowerCase()`), so the alternation never matched: nine waits ran to their full timeout, 20.2 min, and in six the intended ready line was already in the output (12.8 min lost on a sequential path).

ticket: in the pi-processes fork (`~/dev/pi-processes`, branch `local-integration`), reject a `pattern` or `readyPattern` containing an unescaped `|` (or other regex-only syntax such as `.*`) with an immediate error saying patterns are literal, case-insensitive substrings and suggesting one specific literal. Don't reinterpret patterns as regexes. Make the tool description's pattern sentence say "literal, case-insensitive substring".

Acceptance: a test calling wait with `ready|rror` returns the corrective error without waiting; a literal pattern still matches as today.

## Result

done — The change holds. Wait and start reject `ready|rror`, `.*` and similar patterns immediately, and a literal pattern still matches case-insensitively. I made one small docs repair.

The code is in `~/dev/pi-processes`, branch `process-wait-pattern-alternation-implement`, not in this repo. Validation runs before process lookup, so the wait test with `ready|rror` and a 1800 s timeout fails without waiting. `server ready` still matches `SERVER READY`. The pattern descriptions and the tool-description sentence now say "literal, case-insensitive substring".

- **Repair:** the pi-processes `README.md` still called patterns just "case-insensitive substring". It now says literal and that regex syntax is rejected. Commit `5653225` is on the implement branch.
- **Tests:** the full vitest suite passed 278/278 in three runs. One earlier run had a single failure in a fake-timer `process_ended` test, apparently because another vitest run was going at the same time. It didn't recur in the three reruns, and it is unrelated to patterns.
- **Frictions:** the driver reported none, so nothing to triage.

```yaml
commit: 5653225 (pi-processes, branch process-wait-pattern-alternation-implement; builds on 4f6c5d4, base ff4a792); packet note 87d9af5f in this worktree
stories:
  - story: Wait rejects regex-like patterns immediately with corrective guidance
    outcome: held
  - story: Start rejects regex-like readiness patterns immediately
    outcome: held
  - story: Literal patterns retain case-insensitive substring matching
    outcome: held
  - story: Tool description explicitly states literal case-insensitive semantics
    outcome: held
evidence:
  path: docs/attachments/process-wait-pattern-alternation-waits-out-its-timeout/index.md
  visual: false
  shots: []
tests:
  - src/tools/index.test.ts (in pi-processes)
fixed:
  - README pattern wording, pi-processes 5653225
caveats:
  - The code lives in the pi-processes repo, so the parent must merge that branch into local-integration; this repo's diff holds only the evidence packet and unrelated tracker churn.
  - An escaped `\|` passes validation but then matches a literal backslash followed by a pipe. The code comment says this, but it is mildly surprising.
  - The driver used a minimal host adapter, not a full interactive pi session.
```

Evidence: [docs/attachments/process-wait-pattern-alternation-waits-out-its-timeout/index.md](../attachments/process-wait-pattern-alternation-waits-out-its-timeout/index.md)
