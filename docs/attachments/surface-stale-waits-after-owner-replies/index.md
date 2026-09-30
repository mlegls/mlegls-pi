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

## Acceptance review, 2026-09-30

The root owner clarified that the deferred combined code review does not replace this acceptance review. The original first-use record above remains unchanged. This review closes its missing-state gap against production revision `71d10c1`; no production code repair was needed.

### Isolated encounter and replay

`lib/jobs/fixtures/stale-waits.ts` runs the real supervision job in a disposable Git repository, supplies child reports through a fixture transport, and reads the saved job through the real `ab supervise status fixture` CLI. Only tracker discovery, worker transport and the daemon's status response are fixtures. The CLI consumes the loop's saved value, not a separately invented waiting record. A controlled wall clock and scheduled callbacks advance together; these are simulated minutes, not an elapsed-time live-agent trial. No live daemon, owner mailbox or worker was modified.

The fixture starts with one command-mode child and no wait, then reports `blocked`. Its first exception notice is deliberately withheld for 31 minutes. The replay observed:

| Action / clock (UTC) | Visible result |
| --- | --- |
| Empty status | `no supervision jobs here` |
| Child reports blocked at 12:00 | `leaf implement fixture/leaf waiting: blocked since 2026-09-30T12:00:00.000Z` |
| Read status again at 12:31, before notice delivery | Same waiting line and timestamp; zero reminders |
| Deliver exception notice at 12:31 | Owner receives notice; the reminder deadline starts here |
| Advance to 13:00:59.999 | Zero reminders |
| Advance to 13:01 | One owner message: `stale wait: implement leaf is still waiting: blocked. The exception notice was sent at 2026-09-30T12:31:00.000Z and no child turn has arrived since`; it names `fixture/leaf` and its worktree |
| Advance another 30 minutes | Still one reminder |
| Restart the loop from its saved state; advance another 30 minutes | Still one reminder |
| New `needs-input` exception at 14:01; child reports `checkpoint` at 14:30; advance past that exception's deadline | Still one reminder; status now says `waiting: checkpoint since 2026-09-30T14:30:00.000Z` |
| New blocked exception at 14:32 | Status says `waiting: blocked since 2026-09-30T14:32:00.000Z` |
| Advance to 15:02, then another 30 minutes | Second exception receives its own reminder at 15:02; total remains two afterward |

Here “owner mail” is delivery of the exception notice to the owner. An owner steer that produces no child turn adds no loop event. Actual owner-to-worker mailbox delivery is not exercised by this fixture.

### Outcomes and ledger disposition

- **Status shows when a child entered its waiting state — held.** The timestamp is visible and stable across reads, and a later exception has a new timestamp.
- **Owner is re-woken once after 30 minutes without a child turn — held.** Observed the threshold, no early reminder, no repeat even across restart, cancellation on a child turn, and eligibility of a new exception.
- **Empty-state expectation — met**, retained in the replay.
- **Missing isolated setup friction — fixed here.** The committed disposable fixture reaches parked exceptions without dispatching a second live worker. No new production fixture command is needed.
- **Driver checks 1–3 — retained**, encoded in `lib/jobs/stale-waits.test.ts` against CLI text and delivered owner messages. Transport and clock limits are explicit above; no check was dropped.

Replay: `ab check -- bun test lib/jobs/stale-waits.test.ts lib/jobs/supervise.test.ts lib/jobs/loop.test.ts` → **5 passed, 0 failed, 42 assertions**. The encounter first ran as an observation-producing fixture; its observed outputs then became the assertions. Initial fixture preparation needed command-mode startup metadata and canonicalized temporary paths; both are included in the replay.

No services or external resources remain. The fixture aborts its loop and removes its disposable repository. Evidence remains nonvisual (`visual: false`, `shots: []`).

Integration retry: rebased onto `fcc1962`, retaining its clarified review boundary and all acceptance additions. Re-ran the same three test files on the rebased code: **5 passed, 0 failed, 42 assertions**. Both story outcomes remain held.
