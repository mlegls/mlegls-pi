# Checkpoint continuation drive

## Predictions before first use

- With a live managed process (`runsProcess = true`), calling the supplied checkpoint library entry should emit a repair telling the worker to report `waiting`, then checkpoint after completion. It should not launch a continuation or consume checkpoint budget (initial count 2 remains 2).
- With no live managed process (`false`), the next checkpoint should consume one allowance and launch a continuation (2 → 3).
- At an exhausted allowance, a live-process checkpoint should still repair without consuming budget; a process-free checkpoint should raise rather than launch.

## Setup

Local library transition, verifier-owned checkout; no auth, services, seed, or external target. Supplied entry is `checkpoint` from `./lib/reconcile/checkpoint.ts`. No source, tests, diffs or fixtures inspected. Readiness: module present, Bun 1.4.2, clean checkout at `5aeea90b76453f894edd7927ed6f399ae7b4b04b`; supplied entry exited 0. No inherited deployment selectors used.

## Actions and observed results

1. Ran the implementer's supplied `bun -e` command verbatim (import `checkpoint`; chain count 2; limit 3; logging repair/raise/restart/save callbacks; call with true, inspect count, then false).
   - True emitted: “Wait for your running process (report `waiting`), then checkpoint after it completes. A continuation cannot own your session's managed processes; this checkpoint has not counted against the checkpoint budget.” Count stayed 2; no continuation launched.
   - False emitted `continuation launched`, then saved count 3. Both predictions met.
2. Repeated via the same library with fresh count 3, limit 3 for each boolean; callbacks collected event names and arguments.
   - True: only repair, count remained 3. Exhausted budget did not prevent repair.
   - False: only raise, message `checkpointed 3 times`, count became 4. No restart. Prediction met; counted rejected process-free report was not specified by the ticket.

## Replayable checks

- Run the supplied entry command from the ticket's setup handoff on this revision. Accept repair text containing `waiting` and completion-before-checkpoint, unchanged count 2, no restart on true; restart and saved count 3 on false.
- Run `checkpoint` with count 3/limit 3 and callbacks collecting events, separately with true and false. Accept repair-only/unchanged count on true and raise-only/no restart on false.

## Expectations and frictions

All three pre-use library predictions met. No runtime friction encountered in this surface.

The supplied surface takes a boolean and substitutes callback logging for a worker. It establishes the transition's actions, not the live reconciler's `runsProcess(handle)` detection, report wiring, same-session repair delivery, or subsequent automatic completion notification. No actual managed process or worker continuation was exercised. That worker-level claim remains unobservable in this drive and is still owned by this ticket; reviewer must establish wiring/coverage before acceptance. Test-file presence and coverage were not inspected or run, per the driver assignment.

## Outcomes and cleanup

- Live-process library transition repairs without restart or budget consumption: held.
- Process-free library transition restarts within budget: held.
- Actual worker retaining managed-process ownership and waiting through completion: unobservable through the supplied entry.
- Required regression test coverage: unobservable (reviewer responsibility).

Nonvisual library journey; no screenshots. No services, background processes, browser pages or external resources started.
