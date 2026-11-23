---
stage: "idea"
assignee: "human"
priority: 3
author: "session:01a20657-0e8d-726c-98b9-a4f79a5a23fc"
---
Found in the 2026-11-23 audit of the supervision/issue orchestration system (@thread:thr_3pkhxrd57p).

> **Data**: **0 uses across 574 issues** and **0 in 91 runs**.
> **Cost**: Custom frontmatter schema, 4 trigger enums, hardlink `EEXIST` verdict queue, owner-only RPC validation, legacy adapter.
> **Cut**: A normal follow-up verification ticket (or keeping the ticket `assignee: human`) models post-deploy checks with zero reconciler special cases.

Code: [post-landing.ts](../../lib/reconcile/post-landing.ts), [main.ts](../../lib/reconcile/main.ts) `resolveException`, [docs/verification-evidence.md](../../docs/verification-evidence.md#post-landing-gates). Decide whether to cut.
