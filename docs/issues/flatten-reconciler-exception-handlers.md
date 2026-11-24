---
stage: "idea"
assignee: "human"
priority: 3
author: "session:01a20657-0e8d-726c-98b9-a4f79a5a23fc"
---
---
stage: "idea"
assignee: "human"
priority: 3
author: "session:01a20657-0e8d-726c-98b9-a4f79a5a23fc"
---
Found in the 2026-11-23 audit of the supervision/issue orchestration system (@thread:thr_3pkhxrd57p).

> **Data**: Across all 91 runs in this repo (111 implement, 101 drive, 103 review), **1 handler was spawned, 1 escalated, 0 resolved**.
> **Cost**: Handler spawn/retirement/docs-only-integration/withdrawal-race/owner-override machinery throughout [reconcile.ts](../../lib/reconcile/reconcile.ts#L1189-L1278), plus bugs like `holdForeignCommit` routing to an ancestor handler that cannot fix it.
> **Cut**: Escalate directly to the owner (supervisor). If you ever want an automated triage worker, make it one flat opt-in step, not a recursive per-collector hierarchy.

The handler role is [agents/roles/handle.md](../../agents/roles/handle.md). Decide whether to cut.

On 2026-11-24, the blocked Create Mission join passed through three handlers before reaching the run owner (@thread:thr_asxjmzvcsq). Each level had the same plan: supersede four stale collector landing receipts, then reopen the join. Only the owner could apply it. The receipts and recovery are documented in [[projects/mlegls-pi/issues/reconciler-never-reenters-a-reopened-landed-node]].
