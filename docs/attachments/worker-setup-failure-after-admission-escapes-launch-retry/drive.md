# Independent drive

Tested revision: `fe3340f213f5c74172347a9dc74d4e84a7f4d2a8`. Trial completed successfully on 2026-10-08, exit 0, approximately 35 seconds.

## Setup and predictions before use

Persona: developer invoking the committed offline shell-worker trial. No credentials. Target: automatically created fresh temporary repository with isolated thread, board and zmx state; no shared deployment. Entry point: `bun docs/attachments/worker-setup-failure-after-admission-escapes-launch-retry/fixture.ts`. The handoff says the trial cleans up its owned target. No source, tests or fixture contents inspected.

Predictions recorded before invoking the entry point:

1. A setup command that fails once with `fetch failed` will retry once, log that retry, then start the worker.
2. A non-network setup failure will exit after one attempt without starting the worker.
3. A first generic provider error will relaunch the same phase with a fresh handle, without owner notification.
4. A second generic provider error on that node will notify the owner instead of retrying again.
5. An authentication-class error will notify the owner immediately without relaunch.

Readiness was established by successful completion of this fresh trial, not by the implementer's previous run. This CLI journey has no rendered UI.

## Encounter and replayable checks

Action for every row: run the entry point above from the tested checkout. These are the five named outputs to inspect; the expected result is also the replay acceptance criterion.

| Story / output | Expected observation | Actual observation | Outcome |
| --- | --- | --- | --- |
| `setup-network` | Retry logged and worker starts after transient failure | Exit 0, `started: true`; log contained `fetch failed` and `Worker setup network error; retry 1/2 in 15s` | held; prediction met |
| `setup-nonnetwork` | Nonzero exit, no start, no retry | Exit 1, `started: false`; log contained only `invalid configuration` | held; prediction met |
| `generic-first-error` | New handle, no owner mail | `generic-implement-1` → `generic-implement-2`; `ownerMail: 0` | held; prediction met |
| `generic-escalation` | Second error raises to owner | Reason `provider error: provider failed again`; `ownerMail: 1` | held; prediction met |
| `auth-escalation` | Authentication error raises immediately | Reason `provider error: authentication`; `ownerMail: 1` | held; prediction met |

## Frictions and limits

No friction encountered invoking the supplied entry point. Output is a compact per-story summary, rather than an interactive worker session. Observations establish the approved shell-worker fixture journey only; no live provider, credentials or external network was involved. Cleanup is supplied by the committed entry point; the trial exited successfully and no server or other persistent service was started separately by this driver. No screenshots apply.
