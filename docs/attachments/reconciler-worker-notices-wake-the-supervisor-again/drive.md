# Supervisor notice drive

Predictions recorded before first use (`99f99de8`): idle or reconciler-owned child exits won't wake me; working ordinary child exits will. An all-worker group settles locally; a mixed group reaches the model. Late completions settle after retirement, run finish/stop, and restart. A timely worker report cancels a pending status escalation; an unresolved one surfaces after about 90 seconds. A full-day replay leaves maintainer prompts, real exceptions and landings.

## Encounter

Ran both commands in [the setup and replay guide](index.md). The RPC entry announced `NOTICE_RPC_READY` in this worktree's disposable `.wm/` checkout. No credentials or shared deployment were needed. Both commands exited zero.

- **Groups — met.** The owned group returned `bb-local`, zero blocks and zero tokens. The mixed group hit `notice-fixture` with one response block and two tokens. The output distinguishes routing but doesn't display the fallback input to verify its exact bytes.
- **Late completions — partially met.** Live and retired singles each returned `bb-local`, zero blocks and zero tokens. The entry point didn't expose a fresh process reading a stopped run receipt, so restart and stop remain unobserved independently.
- **Child exits — partially met.** The day replay suppressed 16 idle exits. It didn't witness a busy reconciler-owned exit or an ordinary busy-child control.
- **Status hold — unobserved.** An owner exception reached the RPC fallback, but neither entry point exposed a pending missing-status exception or let me time its release. The guide points to a separate transport regression for that behavior.
- **Full day — met for avoiding spurious wakes.** Of 300 inputs, 226 singles, two groups, six bookkeeping notices and 24 landings settled locally; 16 idle exits were dropped. Nine maintainer prompts, 16 exceptions and one direct reply about an active exception (`5ffaea95`) reached fallback. My prediction that landings would themselves wake the model was wrong: the guide says they're retained in context for the next real turn. No missing-status escalation appeared that day.

## Replay checks for the remaining gaps

1. Let an idle ordinary child and a working reconciler-owned child exit. Wait a monitor interval: neither should produce a supervisor model turn. Repeat with a working ordinary child: its exit should produce a notice.
2. Retire a worker, stop its run, restart the supervisor, then deliver that thread's completion. Expect an empty local settlement. Send a grouped notice containing that thread and an ordinary child; capture the fallback's input and compare it with the entire delivered notice.
3. Trigger a missing-status hold. Observe no owner mail during the first minute, then send a valid report before 90 seconds and confirm neither request nor withdrawal arrives. Repeat without reporting; wait beyond 90 seconds plus a reconciliation tick and expect one owner request.

No runtime setup friction. The entry points summarize their inputs and outcomes, which limits direct observation of restart and escalation timing as described above.

## Review and re-drive

- **Working and idle exits — held.** Installed the actual session-meta monitor with a recording `sendMessage` sink and three live child PIDs under an isolated `XDG_STATE_HOME`. After the first five-second poll, terminated all three. The next poll delivered exactly one `triggerTurn: true` message, for `ordinary` with `last state working`. Neither the idle ordinary child nor the working child marked with a reconciler run produced a turn.
- **Worker provenance across the BB boundary — held after repair.** The live supervision plugin rejected a `workerSpawn` request containing `PI_WM_RECONCILER_RUN` at input validation. After building and reloading `bb-plugins` commit `f24662c`, the same request reached the handler and failed with the expected `Project not found` for the deliberately nonexistent project. No worker was created. The ownership regression observed the run marker on all ten submitted worker threads.
- **Groups, finished runs and landings — held.** The RPC fixture now runs against `notice.fixture`, a valid dotted issue slug. Live and retired singles and the owned group settled locally. The fallback echoed the mixed group's entire input and the fixture compared it byte for byte. Landing messages stay in context as the first drive observed.
- **Stop/restart — held after repair.** Used the [stop fixture](../stopped-supervise-jobs-have-no-cleanup-path/fixture.ts), pointed the saved owner cwd at a missing checkout, and stopped through a surviving checkout. Stop recovered the `launch-race` worker (`thr_47fd4b8b`) before retirement and left its thread in `workerThreads`. A fresh Bun process handed its late completion to `reconcilerCompletion` and got `true`. The fixture cleaned up all three workers.
- **Status hold — held.** Both transport cases in `lib/reconcile/exceptions.test.ts` passed. A `waiting` report during the hold removed the exception without request or withdrawal mail. With the persisted hold aged 91 seconds and no report, the owner received one request. These cases exercise the poll/mail loop with a seeded clock origin rather than sleeping for 90 seconds.
- **Day replay — held.** Replayed all 300 inputs after the receipt fixes. The same 26 reached fallback (9 maintainer prompts, 16 exceptions and the direct reply `5ffaea95`).
