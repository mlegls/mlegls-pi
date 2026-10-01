# First-use drive: supervisor status

## Setup

- Revision: `f442a9aada0dcd4936f5c20e37d90799994f363a`.
- Local CLI, this checkout's `./bin/ab`; local user, no authentication.
- Handoff target: read-only status from the default per-user daemon. No persistent seed, no jobs or stale services observed by the implementer. Its removed mocked probe is not drive evidence.
- Entry point: `./bin/ab supervise status [ticket]` from this checkout. Dependencies are present. No daemon restart or shared-state mutation is authorized by this handoff.
- Nonvisual CLI journey; no screenshots.

## Predictions (before first use)

1. **Phase visibility:** status will list each job's current phase. For an integrating job, it will explicitly indicate integration is in progress so I can decide not to restart the daemon.
2. **Worker services:** each job will identify running `ab service` entries started from its workers' worktrees, enough to recognize and stop an unwanted server. Services from other jobs should not appear under that job.
3. **Missing worktrees:** a separate status line will identify running services whose originating worktree has disappeared, even when no jobs remain.
4. **Empty starting state:** if the handoff's empty state persists, the command should respond clearly without inventing jobs or orphaned services. Empty output cannot establish predictions 1–3.

## Session log

1. Read the ticket, README's local execution resources, delivery guide, and implementer's handoff. Wrote predictions above before opening the CLI. Used only public commands; no source, diffs, tests or fixtures were read.
2. Ran `./bin/ab supervise status --help`, `./bin/ab service --help`, and `./bin/ab --help`. Help says status is scoped to the owning checkout, includes phases and worker services, and separately lists missing-worktree services under that checkout's worker directory. `AB_STATE` defaults to the per-user daemon state. Service receipts carry cwd and stop IDs. This confirmed the supplied CLI path and read-only target, not a seeded job.
3. Ran `./bin/ab supervise status`. Exit 0; [captured output](01-status.txt): `no supervision jobs here`, followed by `services with missing worktrees:` and `-`.
4. Ran `./bin/ab supervise status supervise-status-shows-each-jobs-running-services`. Exit 0; [captured output](02-ticket-status.txt) was identical. The entry point reached the status surface, but not any job or worker service in the story.
5. Ran `./bin/ab service list --status running`. Exit 0; returned 26 service records, none in this checkout or the project's worker directory. [Selected metadata](03-running-services-summary.json) records the absence. Other projects' commands and records are deliberately omitted from the packet. None were stopped or altered.
6. Ran `./bin/ab daemon status`. Exit 0; the public daemon response had 235 job records, none owned by this drive checkout. It included the parent ticket's running job under the canonical checkout. [Selected metadata](04-daemon-summary.json). The shared daemon responded, but the intended checkout-owned story state was absent; I did not substitute the canonical checkout as the target.
7. Ran `./bin/ab supervise status --all`. Exit 0; [captured output](05-all-status.txt) still showed no jobs and no missing-worktree services. History did not provide a usable story state.

## Outcomes and expectations

| Claim / prediction | Outcome | Observation |
| --- | --- | --- |
| 1. Show job phase and integration in progress | unobservable; expectation not demonstrated | No job lines in live, ticket-specific, or historical status. |
| 2. Identify each job's worker services without peer services | unobservable; expectation not demonstrated | No relevant services or jobs were present. |
| 3. List services whose worktree disappeared separately | unobservable; expectation not demonstrated | Separate section exists, but contains only `-`; no orphan was encountered. |
| 4. Clear empty starting state | held; expectation met | All three status variants exited 0 and explicitly reported no jobs and an empty orphan section. |

The supplied setup was enough to reach a CLI, not enough to exercise the changed claims. The implementer's removed mocked probe is not reproducible starting state and cannot establish these outcomes. These claims remain open under [the ticket](../../issues/supervise-status-shows-each-jobs-running-services.md), not waived by the empty-state result.

## Frictions

- The handoff's empty state prevents seeing the feature it asks a first user to verify. The actual parent job lives under a different checkout. No committed recipe supplies a checkout-owned active job, integrating job, worker service, or missing-worktree service. Re-reading history did not bridge this gap. This setup limitation is recorded with the existing owner in the ticket's Result.
- Help explains checkout scoping, but the empty-state output itself gives no owning path. On seeing `no supervision jobs here` while the daemon had jobs elsewhere, I had to query the daemon separately to distinguish empty scope from empty daemon. Filed as [empty output hides checkout scope](../../issues/supervise-status-empty-output-hides-checkout-scope.md); this is a usage friction, not proof of a failed ticket claim.

## Replayable checks for review

1. **Empty scope:** from a checkout with no supervise jobs and no running services in its worker directory, run `./bin/ab supervise status`, the ticket-specific form, and `--all`. Accept exit 0, an explicit no-jobs message, and an empty missing-worktree section. Observed in captures 01, 02 and 05.
2. **Phase and restart decision:** prepare a real checkout-owned job through the public supervision surface with a worker still implementing; run status and accept that its phase is shown. Advance that same job to integration and hold the public integration gate long enough to run status; accept explicit `integrate`/in-progress indication until the integration finishes, then no stale in-progress indication. Not observed here; a reproducible setup must supply this state.
3. **Worker-service attribution:** with two checkout-owned jobs and their live worker worktrees, start a distinguishable foreground service via `ab service start` in each worker, record receipts, and wait for readiness. Run unfiltered and ticket-specific status. Accept each service's stop ID and recognizable command under the job owning that worker, with no peer service under the other job. Stop both recorded IDs, rerun, and accept their removal from running-service output. Not observed here.
4. **Missing worktree independent of jobs:** in an isolated owned deployment, start a foreground service through `ab service start` from an owned worker directory and record its ID; remove only that disposable worker directory while keeping the service running. With no live jobs, run status. Accept the separate missing-worktree section naming that service and its vanished cwd. Stop its recorded ID and accept its disappearance on the next status. Not observed here; do not use or delete inherited worktrees for this replay.

## Cleanup and limits

No services, dev servers, browser pages, containers, tunnels, jobs or deployments were started. The inherited daemon and its services were read-only. Full global service/job responses were reduced to selected non-secret metadata before committing. No repairs or tests were written. The packet establishes only the empty state, not acceptance of the three changed claims.
