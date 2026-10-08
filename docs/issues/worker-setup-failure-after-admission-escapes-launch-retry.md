---
stage: idea
assignee: agent
priority: 3
author: "session:review-of-admit-workers-against-a-host-wide-budget"
---

Observation: since [[projects/mlegls-pi/issues/admit-workers-against-a-host-wide-budget]], a worker's `mise run setup` runs in its runner after host admission (`lib/thread/agent-runner.ts`), not inside `newThread`. A failed setup now exits the runner with a log under the thread state directory; `dispatch` has already returned the handle as submitted.

`launch` in `lib/reconcile/reconcile.ts` retries launches whose setup failed on a transient network error (`fetch failed`, `ECONNRESET`, TLS timeouts; the Convex backend lookup case) with a fresh handle. That retry matched the error text thrown out of dispatch, so it cannot fire for workers any more: a flaky setup now shows up as an exited worker with no report, whatever the reconciler's dead-worker handling makes of it. Not driven; the approved trials did not cover setup failure.

Open choice: have the runner retry setup itself on the same transient patterns, or have the reconciler read the setup log of an exited, never-started worker and relaunch, or accept escalation.
