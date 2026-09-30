# Stale supervision waits — first-use drive

## Before opening the product (predictions, 2026-09-30)

The ticket describes two owner-facing stories. From that and the local CLI handoff alone:

1. **Waiting age in status.** If a supervision job is parked on an exception, `ab supervise status` should show `waiting: <reason> since <time>`. I expect to distinguish a newly parked wait from a six-hour-old one without consulting logs. The handoff says this checkout starts with no supervision jobs, so the first status call should instead say `no supervision jobs here`.
2. **Stale owner reply wake.** After the owner sends exception mail but the child has not taken another turn, I expect the owner's supervision loop to wake at 30 minutes, once for that exception, rather than leave the job awaiting a report indefinitely. I expect no reminder before mail, and no repeated reminder after the first wake. This may require a real parked child and an elapsed half-hour; the provided entry point alone does not promise a way to create that state.

## Setup and encounter

Local CLI, checkout `/Users/mlegls/dev/mlegls-pi__worktrees/surface-stale-waits-after-owner-replies-drive` at `bad69e1`. No separate auth. Handoff seed: no supervision jobs. Entry point: `bun ab/main.ts supervise status`. Readiness observed at 2026-09-30T04:39Z: command exited normally with `no supervision jobs here`. `git rev-parse --show-toplevel` matched this worktree, not the canonical checkout. No service, browser or external deployment was started.

### Actions and observed states

1. Ran the handed-off entry point in the owned checkout: `bun ab/main.ts supervise status` → `no supervision jobs here`.
2. Asked the CLI for its public command guide: `bun ab/main.ts supervise --help` → lists `start <ticket>`, `status [ticket]`, `resume`, `adopt`, `stop`. It says `start` dispatches ready children and notifications arrive in the owner's mailbox on exceptions and subtree completion. It does not offer a public parked-job fixture or clock control.
3. Ran `bun ab/main.ts supervise status docs/issues/surface-stale-waits-after-owner-replies.md` and `bun ab/main.ts supervise status surface-stale-waits-after-owner-replies` → each returned `no supervision jobs here`.

**Waiting-age story: unobservable.** The predicted empty-state response held. Neither status invocation produced a parked exception, so none can establish whether its waiting line now contains `since <time>`. Starting supervision on this live ticket in a second checkout would dispatch another worker alongside its actual owner and is not an isolated reproduction.

**One-time 30-minute wake story: unobservable.** No owned job reached an exception or received owner mail; no child turn or timer could be observed. A successful empty-state status invocation says nothing about the loop's temporal behavior. No elapsed-time claim is made.

### Frictions and expectation ledger

- **Met:** empty checkout reports `no supervision jobs here` via the documented entry point.
- **Not observed:** waiting exception line includes a time; the setup contains no waiting job.
- **Not observed:** owner receives one reminder 30 minutes after mail and before a child turn; the setup contains no job, exception, owner mailbox or scheduled wake to observe.
- **Friction:** `status` offers no route from an empty checkout to a representative parked exception; the CLI help documents only dispatch of real children. A user verifying a wait must first run an actual supervised job and induce an exception. The handoff supplies no isolated scenario to do that without competing with the ticket's real supervision.

### Replayable checks for review

1. In an exclusively owned test repository, start a supervision job for a disposable ticket with a child deliberately arranged to park on an exception. Wait until status displays its waiting reason. Run `bun ab/main.ts supervise status <ticket>` twice several minutes apart. Accept if the same waiting line contains `waiting: <reason> since <time>` with a stable, intelligible timestamp corresponding to when the exception began; reject if the time is missing or resets on each status call. Keep the owner mailbox and child's turns visible while doing this.
2. On that parked exception, record the initial owner exception mail and owner-mail timestamp, then send an owner response addressed to the waiting child but prevent/delay a child turn. Observe the owner mailbox before 30 minutes, at or shortly after 30 minutes and after another 30 minutes. Accept if one new owner wake concerning this exception arrives at the threshold and no second reminder arrives for the same exception. A responding owner alone must not be counted as a child turn. Reject if the owner is never woken, is woken early or receives repeat reminders.
3. Repeat check 2 without owner mail; accept if no stale-owner-reply reminder is emitted. Then repeat with a child turn before 30 minutes; accept if no stale-wait reminder is emitted for the already-answered exception. A new exception should be eligible for its own one-time reminder.

These are replay specifications, not checks passed by this drive. This packet is CLI-only (`visual: false`); no screenshots apply.
