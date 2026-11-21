# Waiting-worker nudge: verification

## Driver predictions (before replay)

As an idle implementer who reported `waiting`, I expect no early message while my named process is running, and no early claim of absence when process state is unknown. If the process has exited, I expect one early message telling me to inspect the existing process. If the process receipt is still missing after the ordinary check-in interval, I expect one check-in without a claim that the process is absent.

## Setup and prior evidence

From the candidate checkout, run:

```sh
bun docs/attachments/reconciler-waiting-void-nudge-misses-live-managed-process/replay.ts
```

The script runs the reconciler against a disposable local tracker and BB inbox for an idle implementer. It seeds the already-handled `waiting` report at the relevant age, observes four BB polls per encounter, prints the inbox, and removes each fixture. No daemon, model, credentials, Cloud target, or resident service is needed. Four inbox records and exit 0 indicate a completed replay. Process states here are seeded receipts; the replay does not wait out either wall-clock threshold.

## Independent drive

Ran the entry command from candidate `bee2b630c614d5cb46b26671f396f42ef41d88f9`. It exited 0 after about 30 seconds with four inbox records and two total messages. To replay, run the same command and compare each inbox with the following results. All four predictions were met.

| Worker state | Observed inbox |
| --- | --- |
| Running receipt, waiting 3m | Empty |
| No receipt, waiting 3m | Empty |
| Exited receipt, waiting 3m | One early nudge directing the worker to `process wait` |
| No receipt, waiting 31m | One ordinary message beginning “You reported `waiting` and no completion notice has reached you in 30m.” No claim of process absence. |

The entry command needed no extra setup. The ordinary check-in suggests `process list` and `process output`, whereas the ticket's workaround uses `process wait` on the named process. The replay observes delivery to the simulated inbox only; it does not exercise following those instructions in a live worker.

## Implementer evidence

Observed on `e8409a66`. The existing `bun test lib/reconcile/exceptions.test.ts` passed 7/7 and `bun run typecheck` passed. The first run exposed a fixture teardown race: abort returned before queued owner notices finished, so fake BB could be removed before delivery. `e8409a66` drains those notices before returning; the rerun completed without escaped tells.

The original thread's `claim-current-full-startup` (`proc_27`) reported a log under `/tmp/pi-processes-jkNUZM/` and was still running when the worker called `process wait` after the early nudge. That log location is characteristic of a run without session-bound receipts. The record does not show why the old parent/leader/stdin probe missed the process. In the current worker, a disposable `sleep` started through `process` wrote a version-1 session registry with its exact PID and a `running` status; the same PID showed `/dev/null` on fd 0. The sleep was stopped after inspection.

## Review replay

Changed the ordinary check-in to request `process wait` on the named process, as the early nudge does. On replay, the running and missing 3m inboxes were empty; the exited 3m and missing 31m inboxes each received one message asking for `process wait`. Only the exited case reported no running process. `bun test lib/reconcile/exceptions.test.ts` passed 7/7, including both stalled-tool cases.
