---
stage: ticket
assignee: agent
priority: 3
author: "session:review-of-admit-workers-against-a-host-wide-budget"
---

Observation: since [[projects/mlegls-pi/issues/admit-workers-against-a-host-wide-budget]], a worker's `mise run setup` runs in its runner after host admission (`lib/thread/agent-runner.ts`), not inside `newThread`. A failed setup now exits the runner with a log under the thread state directory; `dispatch` has already returned the handle as submitted.

`launch` in `lib/reconcile/reconcile.ts` retries launches whose setup failed on a transient network error (`fetch failed`, `ECONNRESET`, TLS timeouts; the Convex backend lookup case) with a fresh handle. That retry matched the error text thrown out of dispatch, so it cannot fire for workers any more: a flaky setup now shows up as an exited worker with no report, whatever the reconciler's dead-worker handling makes of it. Not driven; the approved trials did not cover setup failure.

Open choice: have the runner retry setup itself on the same transient patterns, or have the reconciler read the setup log of an exited, never-started worker and relaunch, or accept escalation.

Decision, 2026-10-08: one rule for transient failures, whichever stage they hit. Reconciler state retries; an owner gets mail only when a retry also fails or the failure is not transient.

- Setup: the runner (`lib/thread/agent-runner.ts`) retries `mise run setup` itself on the network patterns `launch` matches today (move the regex to one shared place), up to 2 more times with the same backoff, before exiting. The runner owns setup now, so it owns the retry.
- Provider errors: `onReport` with the `error` tag retries the phase once on its own (what `reconcile_resolve … retry` does), when `errorClass` is neither "authentication" nor "rate limit or quota". A second provider error on that node raises to the owner as now. Seen 2026-10-08 on stopped-supervise-jobs-have-no-cleanup-path: `Codex error: An error occurred while processing your request` came to the owner, whose manual retry then completed the ticket.
- The dead `net` branch in `launch` goes; the git-lock retry stays.

Tests (approved): (1) agent-runner with a stub setup command that fails once with `fetch failed` then succeeds: the worker starts, and the log records one retry; one that fails with a non-network error exits without retry. (2) `lib/reconcile` shell-worker fixture: a worker whose first report carries the `error` tag with a generic body is relaunched with no owner mail; a second error report on the same node raises to the owner; an authentication-class error raises at once.
