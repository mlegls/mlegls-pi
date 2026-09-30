---
stage: idea
assignee: agent
author: "session:01a0f065-abaf-776c-bc8b-419cb9b312e4"
priority: 3
---

`ab edit` two-anchor block replace (`=start end`) rejects a sigiled second anchor: `=mkqv =mn5w` failed with "Line 21 is not a hunk header" (2026-09-30, ab/jevgrep.ts session). Anchors arrive sigiled from `ab read`/`ab grep` output, and the single-anchor form takes them sigiled, so `=a =b` is the natural spelling; only `=a b` parses.

Observed: the error text quotes the whole line but does not say the second anchor must drop its sigil. Either accept `=a =b`, or name the fix in the rejection message ("second anchor: use `=a b`, not `=a =b`").

Workaround: strip the sigil manually; no data loss (stale anchors are rejected, never misapplied).
