# Concurrent reconciler launch verification

## Before first use

Revision: f48c7959f909f039c1e658b8e5dddcee7cb82347.

Setup supplied by the implementer: local fixture using real Git, tracker and reconciler with a fake BB CLI; automatically owned `/tmp/rc-protocol-*` repositories; seeded `thr_old`, `thr_next`, and `thr_final` supervisors, no authentication; ten agent-assigned tickets with creation and preparation barriers. Entry point: `bun test lib/reconcile/ownership.test.ts`, run from this worker checkout. No inherited service or deployment selector is used. The command creates its own target and is the supplied executable encounter surface; source, tests and fixtures were not read.

Predictions from the ticket and setup handoff:

1. Ten concurrent launches with slow preparation all finish, without an owner exception or serialized preparation blocking the group.
2. A launch waiting behind a live owner lock remains pending and retries without escalation; a dead lock holder retains recovery behavior.
3. Taking over while launches are in flight sees each created launch already parented, and prevents superseded supervisors from launching.

## Encounter and outcomes

Ran the supplied entry point on 2026-11-16 using Bun 1.4.4. The fixture created `/tmp/rc-protocol-rHnZFq/repo`, with its own `.git/supervisor.lock`. The runner finished successfully in 16.11 seconds: **1 pass, 0 fail, 62 expectations**. No server or browser was started. This is a fixture-backed CLI encounter, not a live BB deployment or rendered UI.

- **Ten concurrent launches: held through the supplied fixture.** Output showed ten `started quietly (budget 1)` messages, then all ten distinct `launch-0-implement-1` through `launch-9-implement-1` launches completing. The runner reported `concurrent reconciler launches prepare outside ownership, retry live contention and survive takeover` passed. Prediction 1 met at the supplied acceptance surface.
- **Live contention retry: held.** Each of the ten launches emitted `pending behind a live supervisor lock, retrying: Supervisor lock held by pid 281777` before completing. No owner exception was printed. Prediction 2's live-holder portion met.
- **Takeover parenting: held through the supplied fixture's reported acceptance.** The named concurrent/takeover scenario passed. Output does not independently display parent assignments or supervisor transitions; this outcome relies on the supplied scenario's checks. Prediction 3 met at that surface.
- **Dead-holder behavior: unobservable in the printed encounter.** The runner names live contention and takeover, but prints no dead-holder action or result. Prediction 2's dead-holder portion remains unobserved; reviewer should confirm this preservation claim through its public-surface regression coverage. This is an evidence limit rather than an observed failure.

## Frictions and replayable checks

No observed product friction or failed operation. Runtime feedback usefully distinguishes pending live-lock contention from a failed launch. The runner's terse result leaves parenting and dead-holder details implicit; no source was inspected to fill those gaps.

Replay from the tested revision with `bun test lib/reconcile/ownership.test.ts`:

1. Concurrent preparation: accept all ten distinct launch completion messages and a passing concurrent-preparation scenario, with no owner exception.
2. Live contention: accept pending/retrying messages followed by completion for every launch, rather than an exception requiring an owner retry.
3. Takeover: accept a passing takeover scenario; reviewer should confirm its public-surface checks observe parenting before takeover and refusal of stale-owner launches.
4. Dead-holder recovery: reviewer should drive a dead holder through the public lock/reconciler surface and observe the existing recovery result; this run's output does not establish it.

## Cleanup

The runner exited normally; no long-running services were started. Fixture cleanup is provided by the supplied entry point. No shared deployment was modified. Parent links this packet when recording the ticket result; the ticket remains open.

## Review

Read the diff (ownership.ts, reconcile.ts, dispatch.ts, wm.ts, thread/runtime.ts) with the fixture test. `bun test lib/reconcile/ownership.test.ts`: 1 pass, 62 expectations, ~16 s. `bun test lib/reconcile` (53 pass) and dispatch/wm/handover/thread tests (36 pass) also pass. No repairs needed.

1. Concurrent preparation: held. The lock directory is absent while ten prepares run; only thread creation sits under the lock.
2. Live contention: held. The test advances the clock past the 10 minute wait with a live-pid holder; each launch logs "pending behind a live supervisor lock" and has no exception or owner tell. `OwnershipLockBusy` is thrown only when a pid is recorded, and `launchNow` retries it.
3. Takeover: held. The test asserts the first created thread's parent is the current owner, that a takeover started inside the creation lock waits (`transferred` false, old owner unarchived) and that all ten launched threads end parented to the final owner.
4. Dead holder: held. The test rewrites the holder pid to a dead one and the launches proceed through the unchanged reclaim path in `ownershipLock`. A holder with no pid keeps the generic error.

Caveat: a launch behind a permanently live holder retries without bound, logging once per 10 minute wait.
