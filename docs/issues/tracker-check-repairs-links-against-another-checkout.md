---
stage: idea
author: session:2026-09-26T09-29-46-063Z_01a0dd0c-9b4f-7795-aad1-0299963801cf
---

A September 25 Concept worker reports that `issues.ts check` resolved vault-absolute links through the canonical checkout, rewrote its branch's archive links back to live paths, and could not see new branch-local attachments. A worktree-local TRACKER_VAULT mapping avoided those fixes. A September 23 coordinator reports reverting 48 unrelated link rewrites before cherry-picking.

Check-time repair is documented behavior, not an undisclosed bug. The unresolved question is which checkout owns link resolution when checking a branch; separating inspection from repair may also reduce unintended churn. Sources: research review E.

[Session evidence and dispositions](../research/session-friction-review-2026-09-26.md).
