# Dead-worker first-use encounter

## Before first use

Tested revision: `8fc4d537a7cb9aa849de88c15e90e7d857019a47`.
Persona: the owning supervisor waiting for a worker, through `ab supervise` and exception mail; no rendered UI.

Predictions from the ticket and user documentation:

1. A provider-error assistant message followed only by custom entries for a few minutes should wake the owner. The exception should identify the provider error, session file and file size. File mtime updates should not defer detection.
2. `ab supervise status <ticket>` should distinguish that worker as dead rather than still `implement`, `drive` or `review`.
3. A healthy worker spending longer than the grace period on a turn should remain live and send no death exception.

Expected actions: prepare a checkout-owned isolated supervision and worker; induce the error through the provided setup; wait a few minutes; read mail and status; repeat with a healthy long turn.

Setup handoff: `null`. There is no supplied deployment kind, target, seed, persona/authentication or entry point. The board implementation note mentions a fixture but does not name a runnable setup. The docs describe production start/adopt/status and developer setup, but not how to create a safe injected provider error. I will first inspect CLI help and checkout-owned status rather than adopt an inherited worker or launch this ticket against the parent's ongoing run.

## Encounter log

2026-09-30, checkout `/Users/mlegls/dev/mlegls-pi__worktrees/parent-waits-on-worker-that-died-without-a-report-drive`.

- Read the ticket, README, delivery/dispatch documentation, supervision instructions and `ab supervise --help`; no implementation, diffs, tests or fixtures read.
- Ambient `ab supervise status parent-waits-on-worker-that-died-without-a-report` responded `no supervision jobs here`. Its `AB_STATE` was the shared `/Users/mlegls/.local/state/ab`; this is not an owned test target. I did not start, adopt or stop any inherited supervision.
- Adapter discovery (`ab lib jobs`) refused with `Cannot find module '/Users/mlegls/dev/mlegls-pi/lib/jobs.ts' imported from /Users/mlegls/dev/mlegls-pi/ab/main.ts`. This also established that the ambient launcher addresses the canonical checkout, not this worker's code. It did not expose an injected-error entry point. This was a discovery attempt, not a claim that `jobs` is a documented adapter.
- Reached the checkout-owned CLI using `AB_STATE="$PWD/.wm/drive-ab-state" bun ab/main.ts supervise --help`. The committed [help output](cli-help.txt) offers start, adopt, status and resume, but no failure-injection/session-seeding command.
- Ran `AB_STATE="$PWD/.wm/drive-ab-state" bun ab/main.ts supervise status parent-waits-on-worker-that-died-without-a-report`. Observed [no supervision jobs](status.txt). CLI is responding on the tested revision; the required worker/session state is absent.
- Stopped the isolated daemon with `AB_STATE="$PWD/.wm/drive-ab-state" bun ab/main.ts daemon shutdown`; observed `daemon stopped`.

There was no setup handoff entry point to execute. The recovered entry point reached an empty status surface, not the provider-error story. Neither owner exception mail nor a dead child was observed. Production `start` launches real workers and integration; `adopt` requires an existing worker handle. Without a prepared error/healthy worker route or documented injection mechanism, I did not invent session formats or touch the parent run. This is a setup failure, not a failing observation of the implemented detection.

## Story outcomes

| Story | Outcome | Observation / gap |
| --- | --- | --- |
| Error followed by custom entries wakes the owner within minutes, naming error, session path and size | unobservable | No error worker, seed or mail-capture route supplied. |
| Status marks the errored worker dead rather than its phase | unobservable | Owned status is reachable but contains no jobs. |
| Healthy long turn does not produce a death exception | unobservable | No healthy worker scenario supplied. |

## Frictions and expectations

- Null setup made the required first-use starting state unreproducible through the documented surface. Existing owner: [backend-supervisor-test-entry-does-not-expose-handoff-routing](../../issues/backend-supervisor-test-entry-does-not-expose-handoff-routing.md).
- Ambient CLI addresses the canonical checkout and a shared daemon; a responding CLI alone was not deployment readiness. Workaround: explicit checkout CLI plus isolated `AB_STATE`.
- Initial predictions 1–3 remain unobserved, not met or disproven.
- Expectation formed while using help: an owned `status` command should work with isolated state — **met**, returning no jobs.
- Expected prepared worker starting state — **not met**; empty status instead.

## Replayable checks for review

These are proposed encounters, not executed tests. Their missing prerequisite is a committed, runnable setup through the public surface that creates an owned worker/session and exposes owner mail.

1. Start that setup on this checkout with an isolated state directory. Cause a provider error and record the assistant error timestamp. Continue only custom writes, updating file mtime for at least three minutes. Capture exception mail and `supervise status` over that interval. Accept a wake within minutes containing the actual error text, exact session path and current byte size; status must say dead rather than its running phase. Do not accept merely a process-exit notice.
2. Repeat with a healthy turn lasting longer than the same interval. Accept no death exception and no dead status. Capture intermediate observations rather than relying on one final frame.
3. Keep the failed worker process alive and idle during check 1. Accept the same death notice independent of process exit. This replays the ticket's third case.

No screenshots: CLI-only encounter. No servers, real workers or browsers started; isolated daemon stopped. No product repairs or tests written. Acceptance is not established by this packet.
