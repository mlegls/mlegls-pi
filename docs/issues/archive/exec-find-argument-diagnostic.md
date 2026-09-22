---
stage: done
priority: 3
---

find rejects a non-string glob at the API boundary, naming the supported signature and suggesting brace globs or separate calls. Array/null/number probes returned the diagnostic; lib/{route,pool}.ts still found both files. The exec README also demonstrates single-backslash jq interpolation in sh.raw; the example returned ok:7.

Resolved 2026-09-21. [Original triage](../../research/session-friction-triage-2026-09-21.md).
