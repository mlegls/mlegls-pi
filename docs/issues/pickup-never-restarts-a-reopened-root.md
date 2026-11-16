---
stage: "ticket"
assignee: "agent"
priority: 2
author: "session:01a1e11e-1e93-773b-9956-3d4ce13ef0d8"
---
# Pickup never restarts a reopened root

`select` in `lib/reconcile/pickup.ts` skips any frontier row with recorded reconciler state ("has reconciler state (done); restart it by hand") and any row in `started`. A root its reconciler finished as done and someone later reopened as a ticket therefore never runs again unless a person notices.

Observed: [[projects/concept/issues/tag-chunk-refresh-can-exhaust-occ-retries-against-collector]] finished 2026-11-03, was reopened as a ticket on 2026-11-15 after the failure reached production (Sentry CONCEPT-CONVEX-2K/2M), and every pickup scan since has skipped it. The 11-15 daily report's "restart it by hand" note reached nobody; the concept supervisor was idle. Found by the 2026-11-16 efficiency audit (@thread:thr_js85m2wmby).

## tasks

1. A root whose recorded reconciler finished `done` and whose subtree changed after that finish is restartable: pickup starts it as it would a new root and replaces its `started` entry. `stopped` stays skipped (someone stopped it on purpose), as does `done` with no later change, so a reconciler that finishes without closing can't loop.
2. The restarted run starts its phase numbering past the old run's branches: restarting by hand on 2026-11-16 first collided with the leftover `…-implement-1` and `…-drive-2` branches, and the supervisor had to rename them (@thread:thr_ihbpyrp6s2).
3. Done when: a `select` test with a `done` run finished before the row's last change starts it, and the same run with no later change, and a `stopped` run, are still skipped, and a restart beside the old run's phase branches launches without a collision.
