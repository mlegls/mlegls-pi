# Waiting-worker nudge: implementation first use

From the candidate checkout, run:

```sh
bun docs/attachments/reconciler-waiting-void-nudge-misses-live-managed-process/replay.ts
```

The script runs the reconciler against a disposable local tracker and BB inbox for an idle implementer. It seeds the already-handled `waiting` report at the relevant age, observes four BB polls per encounter, prints the inbox, and removes each fixture. No daemon, model, credentials, Cloud target, or resident service is needed. Four inbox records and exit 0 indicate a completed replay. Process states here are seeded receipts; the replay does not wait out either wall-clock threshold.

| Worker state | Observed inbox |
| --- | --- |
| Running receipt, waiting 3m | Empty |
| No receipt, waiting 3m | Empty |
| Exited receipt, waiting 3m | One early nudge directing the worker to `process wait` |
| No receipt, waiting 31m | One ordinary 30-minute check-in asking the worker to check |

Observed on `e8409a66`. The existing `bun test lib/reconcile/exceptions.test.ts` passed 7/7 and `bun run typecheck` passed. The first run exposed a fixture teardown race: abort returned before queued owner notices finished, so fake BB could be removed before delivery. `e8409a66` drains those notices before returning; the rerun completed without escaped tells.

The original thread's `claim-current-full-startup` (`proc_27`) reported a log under `/tmp/pi-processes-jkNUZM/` and was still running when the worker called `process wait` after the early nudge. That log location is characteristic of a run without session-bound receipts. The record does not show why the old parent/leader/stdin probe missed the process. In the current worker, a disposable `sleep` started through `process` wrote a version-1 session registry with its exact PID and a `running` status; the same PID showed `/dev/null` on fd 0. The sleep was stopped after inspection.
