# Independent first-use drive

Revision: e16bc31b508b97f5a30e3eab3b26ad82e813d98d. Persona: supervisor using isolated local shell workers, no authentication. Setup entry points supplied by implementer; fixture owns temporary repositories and semaphore pool, not shared workers.

## Predictions before use

- Capacity: prepare capacity should provide commands to launch two owners into a pool of size one. I expect the first to run, the second to show queued (not failed), and retiring the first to admit the second.
- Pressure: prepare pressure should provide a controllable probe. I expect high pressure to show a queued launch, and changing the probe to low to admit it.
- Status: queued reasons should be visible on the supplied supervisor/tree surfaces. Cleanup should retire only fixture-owned resources.

## Encounter

2026-10-08: Both preparations completed successfully from this checkout. Capacity target `/private/tmp/worker-budget-PxczqW`; pressure target `/private/tmp/worker-budget-0BR0SO`. No deployment selectors, credentials, browser or shared service were reused. Each target reported its owned commands and initial state before interaction.

### Capacity — held

`prepare capacity` submitted handles for two different repository owners, with empty pending lists. First thread `b559f2a8-a9d1-4410-80db-aa0165cde057` was working/running, slots 1, setupPrepared true. Second thread `0cf3b1a7-9062-49c5-9fb6-09f02ac24636` was queued with reason `worker slots`, setupPrepared false. `threads ROOT` displayed that reason with process/RSS counts; `tree-list ROOT` displayed `⌛ owner-b/second queued: worker slots`. The inspect projection exposed the same admission on the second owner's reconcile chain.

`retire ROOT first` closed the first thread and killed six owned processes. Subsequent `inspect ROOT` showed the same second thread working/running, setupPrepared true, admission timestamp 09:39:27.002Z. No resubmission was needed.

### Memory pressure — held

`prepare pressure` submitted first thread `ffa66cba-678b-4cc6-8054-fa46aa76eaf7`. Its state was queued, reason `memory free 1% < 10%`, setupPrepared false. Both `threads ROOT` and `tree-list ROOT` displayed the pressure reason; the reconcile-status projection matched it.

`low ROOT` reported the probe now low. After the next probe, `inspect ROOT` showed the same thread working/running at 09:39:36.648Z, freePercent 80, setupPrepared true. The text tree changed to `● owner-a/first` with six processes / 82MB.

### Expectations and frictions

All three predictions above were met on the CLI/status surfaces. No encounter friction observed. The queued worker itself used four or five infrastructure processes before setup; the displayed census makes that cost visible rather than suggesting queued means zero host cost.

### Replayable checks

From the tested checkout, run `bun docs/attachments/worker-admission/fixture.ts prepare capacity`, taking its printed root as ROOT. Run `threads ROOT`, `tree-list ROOT`, and `inspect ROOT` through the same fixture CLI. Accept only first running and second queued with a slot reason and setupPrepared false. Run `retire ROOT first`, then inspect after the admission probe; accept only second running with setupPrepared true without relaunch.

Repeat with `prepare pressure`: accept queued pressure reason in threads/tree/status and setupPrepared false. Run `low ROOT`, inspect after the documented two-second probe; accept running, freePercent 80 and setupPrepared true. Run `cleanup ROOT` for each target.

### Cleanup and scope

Both cleanup commands completed successfully, closing remaining threads, killing six owned processes each, and deleting owned worker branches. Both fixture directories were removed. No servers or external resources remain.

Nonvisual encounter: no screenshots. Uses the approved shell-worker substitution and isolated semaphore pool. Reconcile status was the real projection over fixture-seeded paused caches, not an autonomous reconcile run. This packet verifies the approved two admission trials and CLI tree, not native sidebar rendering or a real high-pressure host.

## Review

Reviewer pass over 9b844cd..HEAD, reading the diff against the driver's log.

- The ticket's two approved tests were not in the change. Added `lib/thread/admission.test.ts`: shell workers, isolated `PARALLEL_HOME`, `WORKER_SLOTS=1`, two repositories as two owners; (1) second owner's worker stays `queued: worker slots` until the first is retired, then runs; (2) probe stubbed to 1% free queues with a memory reason, then runs after the stub reports 80%. Three consecutive passes, about 10 s per run, no fixtures left in zmx or /tmp.
- `lib/reconcile/refresh.test.ts` asserted worker setup had completed when `spawn` returned. Setup now runs after admission, so that assertion waits for `setup-contract` to appear (assertions on its content unchanged). Failed at the change's head before the edit, passes on the base and after.
- Driver outcomes stand: all three stories held; the repairs touch only tests. `bunx tsc --noEmit` clean; `lib/thread`, `lib/tree`, `lib/reconcile`, `lib/dispatch` tests pass.
- Filed [[projects/mlegls-pi/issues/worker-setup-failure-after-admission-escapes-launch-retry]]: moving setup behind admission means reconcile's transient-network setup retry no longer sees the failure.
