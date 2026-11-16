# Independent first-use drive

## Before use

Tested revision: `bec8f956ef4ce8e63d41397efa40befe048d800c`.

Setup: isolated local library/API replay in this drive worktree. The supplied entry point is present here; use this checkout rather than the implementer's checkout. The documented target is a newly created temporary Git repository, removed by the replay. No authentication, server, watcher or actual worker is required. Seed: reopened ticket, prior pickup entry and recorded done/stopped runs. Readiness is established by completion of the replay.

Predictions from the ticket and setup documentation, recorded before running:

1. Pickup starts a new root, then starts it again after a later issue change following a done run; the recorded started PID changes from 101 to 102.
2. A done run with no later change remains skipped.
3. A deliberately stopped run remains skipped even with a later issue change.
4. A restart beside previous phase branches should archive prior branches and choose a fresh phase number, with fresh reconciler state rather than reporting the old landing. The supplied documentation says its callback uses synthetic PIDs and launches no worker, so I expect this final claim may remain unobservable through this entry point.

Reproduction: `bun docs/attachments/pickup-never-restarts-a-reopened-root/first-use.ts`.

No source, tests, fixtures or replay implementation inspected.

## Encounter

Ran the documented command from this worktree on 2026-11-17 UTC. It exited 0 in one second. No service was started. The replay reported:

- `first pickup`: started `["reopened"]`, no skipped rows.
- `unchanged done`: started `[]`; skipped `reopened` with `has reconciler state (done); restart it by hand`.
- `reopened done`: started `["reopened"]`, no skipped rows.
- `started replacement`: old PID 101 at `2026-11-16T16:06:28`, new PID 102 at `2026-11-16T16:06:29`.
- `changed stopped`: started `[]`; skipped `reopened` with `has reconciler state (stopped); restart it by hand`.

Predictions 1–3 met. Prediction 4 remains unobservable: this setup reaches the pickup scan with a synthetic start callback, not reconciler initialization or a worker launch. There is no output demonstrating archived branches, fresh state, phase numbering or a successful launch beside existing branches. This is a setup coverage gap, not an observed product failure. The existing execution ticket owns this required claim; it remains open for the reviewer to obtain a real reconciler-start encounter.

## Frictions and replayable checks

- Setup coverage: the supplied entry point cannot establish the branch-collision and stale-landing acceptance claims. Replay with a temporary owned Git repository containing a done run with a recorded landing and old implement/drive phase branches; reopen its ticket, start through the public reconciler API, and accept only fresh state plus a successful worker launch with a phase number beyond those branches. Repeat with direct manual restart as well as pickup.
- The unchanged-done message says `restart it by hand`, although this ticket describes automatic eligibility after later changes. No functional failure observed; wording is a minor expectation mismatch for the reviewer to consider within this ticket.
- Pickup checks to replay: run the documented command; accept first start, unchanged done skipped, later-change done restarted with its recorded PID replaced, and later-change stopped skipped. All four observed outcomes held.

No rendered surface; no screenshots. No credentials used, external services started or shared state modified by the documented replay. Temporary-repository removal is the entry point's documented behavior, not independently inspected.

## Review

Prediction 4 was unobservable through the replay, and the diff did not implement it: the implementation covered only pickup's `select`. The review added it in `lib/reconcile/reconcile.ts` (`supersede`, called from `prepareStart`, so pickup, `reconcile` and the foreground `run` share it): a run that finished `done` whose root issue is no longer done starts over. Its `<root>.json`, `.log` and `.resolutions` move to `<git-common-dir>/reconcile/superseded-<stamp>/`; the new state keeps owner, landing mode, budget (from the start) and the handle counter, so the new worker's branch is numbered past the old run's. PR-mode runs (recorded `pr`) resume as before.

Observed through a real reconciler process on the fake bb CLI (`bun test lib/reconcile/resume.test.ts`, "a reopened root whose run finished done starts over…"): a `done` state recording a landing, counter 2, branches `solo-implement-1` and `solo-drive-2`, root ticket open. After `start`: no `finished`, empty `landed`, the archive holds the old state with its landing, and the launched worker is `solo-implement-3`, with no branch collision. The same test on the pre-repair `reconcile.ts` times out with no worker launched. All 55 tests under `lib/reconcile/` pass.

Prediction 4 held. The `restart it by hand` wording stays: it is accurate for an unchanged done root, which still doesn't restart.
