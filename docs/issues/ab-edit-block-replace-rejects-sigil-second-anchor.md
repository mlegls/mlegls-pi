---
stage: done
assignee: agent
priority: 3
part-of: "[[projects/mlegls-pi/issues/small-ab-cli-fixes]]"
author: "session:01a0f065-abaf-776c-bc8b-419cb9b312e4"
---

`ab edit` two-anchor block replace (`=start end`) rejects a sigiled second anchor: `=mkqv =mn5w` failed with "Line 21 is not a hunk header" (2026-09-30, ab/jevgrep.ts session). Anchors arrive sigiled from `ab read`/`ab grep` output, and the single-anchor form takes them sigiled, so `=a =b` is the natural spelling; only `=a b` parses.

Observed: the error text quotes the whole line but does not say the second anchor must drop its sigil. Either accept `=a =b`, or name the fix in the rejection message ("second anchor: use `=a b`, not `=a =b`").

Workaround: strip the sigil manually; no data loss (stale anchors are rejected, never misapplied).

ticket contract, 2026-09-30: `ab edit` accepts `=a =b` for a two-anchor block replace (as well as `=a b`), with a test.

## Result

CLI drive: [verification packet](../attachments/ab-edit-block-replace-rejects-sigil-second-anchor/index.md). Both replacement spellings held on `4678f1c`; test coverage is left for review.

## Verification evidence

[Encounter and evidence](../attachments/ab-edit-block-replace-rejects-sigil-second-anchor/index.md).
