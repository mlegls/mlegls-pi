---
stage: "idea"
assignee: "human"
priority: 3
author: "session:01a20657-0e8d-726c-98b9-a4f79a5a23fc"
---
Found in the 2026-11-23 audit of the supervision/issue orchestration system (@thread:thr_3pkhxrd57p).

> **17 skills + 19 agent/role files** repeat the same handoff/claim/move-out/sentinel rules in 3–5 places each, causing the drift above; `dispatch` (10 lines) and `merge` (6 lines) are pure wrappers around `docs/dispatch.md`; `desk/ROLES.md`'s per-session `working set` line is stale in live use.

The drift this caused (move-out assignment in `supervise` vs the reconciler, `refine` filing human children the reconciler rejects, reviewers emitting `redrive` that nothing read) was fixed in place on 2026-11-23; the duplication that let it happen remains. Also from the audit: collapse [dispatch.ts](../../lib/dispatch.ts) straight onto `lib/thread/*` once [[projects/mlegls-pi/issues/delete-dead-wm-and-thread-code]] removes the dead [wm.ts](../../lib/wm.ts) layer.
