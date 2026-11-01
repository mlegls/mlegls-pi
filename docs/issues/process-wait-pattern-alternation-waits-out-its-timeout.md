---
stage: "ticket"
assignee: "agent"
priority: 3
author: "session:thr_ae8q9yrxnv"
---
idea: efficiency audit 2026-11-02 (@thread:thr_ae8q9yrxnv; auditor @thread:thr_u4p4mait39). In @thread:thr_78sspagtst agents waited with `process wait` patterns such as `driver ready|rror`. The pattern is a case-insensitive literal substring (`~/dev/pi-processes/src/manager.ts` scanForPattern: `needle = pattern.toLowerCase()`), so the alternation never matched: nine waits ran to their full timeout, 20.2 min, and in six the intended ready line was already in the output (12.8 min lost on a sequential path).

ticket: in the pi-processes fork (`~/dev/pi-processes`, branch `local-integration`), reject a `pattern` or `readyPattern` containing an unescaped `|` (or other regex-only syntax such as `.*`) with an immediate error saying patterns are literal, case-insensitive substrings and suggesting one specific literal. Don't reinterpret patterns as regexes. Make the tool description's pattern sentence say "literal, case-insensitive substring".

Acceptance: a test calling wait with `ready|rror` returns the corrective error without waiting; a literal pattern still matches as today.
