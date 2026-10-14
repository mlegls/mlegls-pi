---
stage: "done"
assignee: "agent"
author: "session:01a13a17-ba44-7373-87c5-ca7eff662862"
---
Make bb the only thread runtime and delete the zmx one, so workers and threads always run as bb threads.

Today `lib/thread` (`defaultRuntime` in `lib/thread/bb.ts`) picks bb when `BB_THREAD_ID` is set or `PI_THREAD_RUNTIME=bb`, else zmx (`docs/dispatch.md`, "A thread spawned from a session running inside bb"). Decided 2026-10-14: bb is the GUI, so the zmx runtime and its host admission (`sem` slot, memory gate in `lib/thread/admission.ts`) go.

Done:
- `lib/thread/zmx.ts`, `to-bb.ts` (the zmx→bb migration) and the zmx paths in `runtime.ts`, `lifecycle-cleanup.ts` and `launch.ts` are removed; `PI_THREAD_RUNTIME` is gone.
- The runtime is always bb, from inside a bb thread or from a plain terminal (the bb CLI reaches the daemon either way; verified 2026-10-14 with `BB_*` unset). Without `BB_THREAD_ID` the bb thread is top-level, which is fine: board reports and integration don't depend on bb nesting.
- When the bb daemon isn't reachable, spawning fails before creating a worktree with one clear error saying to start bb.
- A non-pi `launch.cmd` (`wm spawn --command`, `lib/wm.ts`) has no runtime left: reject it with a clear error and drop the option where nothing uses it.
- Host admission that only applied to zmx is removed, or kept only if bb threads use it; the reconciler budget and `maxConcurrent` remain the limits, as already documented for bb.
- zmx leaves `mise.toml`/setup if nothing else needs it.
- Docs say bb: `README.md`, `docs/dispatch.md` (zmx on PATH, runtime selection), `skills/enabled/pi/mlegls-pi/SKILL.md` and `skills/enabled/all/mlegls/orchestrations/multi-agent/SKILL.md` ("a worktree and a zmx session running pi"), and the supervision tool's description if it names zmx.
- Existing registered zmx threads: `ab thread ls` still lists or cleanly reports them so they can be abandoned; no migration needed.
- `bun run typecheck` and `bun test` pass; drive one dispatch + integrate through bb.

decisions:
- 2026-10-14: bb is the only runtime, also from plain terminals; no zmx fallback; non-pi worker commands are dropped.

Drive evidence (pending review, not completion): [bb-only encounter](../attachments/delete-the-zmx-thread-runtime/index.md).

## Result

done

All required stories hold on the final head (aec3cb99). I fixed one real regression, restored the deleted tests on a fake bb CLI, and observed the two stories the driver couldn't. `bun run typecheck` is clean and the full `bun test` passes (222 pass, 2 skip, 0 fail). That run came before two small import-removal edits, so I re-ran typecheck and `lib/reconcile`, `lib/thread` and `lib/wm.local.test.ts` afterwards (27 pass, 0 fail). There is no `test:affected` task here.

**What I changed**
- **Setup regression (`4ffe6ba2`):** the rewritten `pendingSetup` in `lib/thread/setup.ts` had dropped three things the deleted agent-runner did. I restored them:
  - A worker handed a pending merge skips setup. The reconciler's refresh prompt promises this, and without it the spawn fails on conflict markers.
  - A worker's setup retries transient network failures twice.
  - An interactive thread's setup runs beside its pi instead of delaying it.
- **Tests restored on a fake bb CLI (`e8af410f`, supervisor ruling 1):** `lib/thread/fake-bb.ts` is a script on `BB_CLI` that records calls and answers spawn, list, stop, archive, tell, log, wait and open. Restored: `refresh` (both tests), `constraints`, `stop` (its attachment fixture), `retry`, `lifecycle`, `runtime`, `cli` (row formatter only) and `wm.local`. `wm.local` stays opt-in. `admission.test.ts` and the agent-runner stay deleted.
- **Unused imports:** removed the ones the deletion orphaned in `lib/wm.ts` and `lib/thread/cli.ts`.
- **Packet:** appended my review to `docs/attachments/delete-the-zmx-thread-runtime/index.md`. The driver's record above it is unchanged.

**Stories the driver couldn't observe, now observed**
- **Unreachable daemon:** `BB_CLI=/usr/bin/false ./bin/ab thread new --worktree probe-wt` printed one "bb is not running: start the bb app" line. No worktree or branch was created.
- **`launch.cmd`:** `newThread({ launch: { cmd } })` throws "Threads run pi in bb; a launch command is not supported".

**Supervisor ruling 3:** I kept `extensions/workspace/index.ts` and `move.ts`. They serve `/workspace` in any pi, plain terminal sessions included. The `session_start` handler in `thread.ts` keeps the registry on whatever session pi continues in, whichever process hosts it. The zmx restart-on-quit sentence is already gone from the README.

**Friction:** the driver's finding (stale loaded tool descriptions) already sits in `docs/issues/drive-pi-extensions-from-reviewed-worktree.md`. I left it there and filed nothing new.

```yaml
commit: aec3cb99
stories:
  - {story: Dispatch and integrate through bb, outcome: held}
  - {story: Plain-terminal launch creates top-level bb thread, outcome: held}
  - {story: Legacy registrations remain listable, outcome: held}
  - {story: Non-pi CLI option removed, outcome: held}
  - {story: Unreachable daemon fails before worktree creation, outcome: held}
  - {story: Direct launch.cmd rejection, outcome: held}
evidence:
  path: docs/attachments/delete-the-zmx-thread-runtime/index.md
  visual: false
  shots: []
tests:
  - lib/reconcile/refresh.test.ts
  - lib/reconcile/constraints.test.ts
  - lib/reconcile/stop.test.ts
  - lib/reconcile/retry.test.ts
  - lib/thread/lifecycle.test.ts
  - lib/thread/runtime.test.ts
  - lib/thread/cli.test.ts
  - lib/wm.local.test.ts
filed: []
redrive: false
caveats:
  - "Tests changed: the restored tests swap zmx shell workers for fake-bb threads. runtime.test.ts's terminal-ensure and history assertions became fake-bb tell/log checks, and cli.test.ts keeps only the row-formatter test because the fork test's subject is gone. The retry fixture's setup half now calls pendingSetup directly with a fake mise."
  - "Cost: the restored suites add about 80 s to bun test (summed per-test times). retry.test.ts is 43 s of that, 15 s of it the real network-retry backoff. Full suite: 142 s."
  - "The dispatch and integrate drive still can't confirm which code revision the loaded tools ran (tracked in drive-pi-extensions-from-reviewed-worktree)."
  - "Interactive-thread setup is back to running beside pi, and the CLI process stays alive until mise exits. I didn't exercise it end to end."
```

Evidence: [docs/attachments/delete-the-zmx-thread-runtime/index.md](docs/attachments/delete-the-zmx-thread-runtime/index.md)
