---
stage: "idea"
assignee: "agent"
priority: 3
author: "session:01a20657-0e8d-726c-98b9-a4f79a5a23fc"
---
Found in the 2026-11-23 audit of the supervision/issue orchestration system (@thread:thr_3pkhxrd57p).

- Three disjoint integration locks: `ab-integrate.lock` in [task.ts:60](../../lib/task.ts), `reconcile/integrate.lock` in [reconcile.ts](../../lib/reconcile/reconcile.ts) (around `integrate`), none in [dispatch.ts](../../lib/dispatch.ts) `integrate`. A task finish, a reconciler landing and a manual `integrate` into the same checkout can interleave.
- [ownership.ts:14-21](../../lib/reconcile/ownership.ts): two waiters that both find a dead holder can both `rmSync` the lock; the slower one removes the faster one's fresh lock.
- [process.ts:7-10](../../lib/reconcile/process.ts) `waitForPredecessor` loops while the old reconciler pid lives, with no bound: a hung predecessor stalls the restarted run silently.

Needs a look at what each lock protects before choosing one lock (or a shared helper) for integration into a checkout. Fixed in place already: `resolveException` now publishes resolutions with write+rename.
