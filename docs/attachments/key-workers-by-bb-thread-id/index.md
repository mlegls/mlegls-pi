# Worker identity first-use verification

Tested revision: `989d8fc4d56f42393a3b159dda201d07a08d4172`. CLI/library journey; visual false, no screenshots. Driver read ticket and user-facing docs, not implementation, diffs, tests or fixtures. No product repairs.

## Predictions recorded before opening the product

From the ticket and `docs/dispatch.md`:

1. Lookup will identify workers by bb thread id, run and handle without an ab registry.
2. A worker titled `<run>/<handle>` will be recoverable after an interrupted spawn omitted it from run state.
3. Reconciler notices will identify their owning workers and routine completions will be filtered.
4. Session metadata and graph descriptions will omit removed view-only fields.
5. Restarting a reconciler will reattach live workers, not duplicate them.

Expected actions: launch an isolated worker, inspect identity, interrupt/restart an owned reconciler, observe recovery and notices, then retire the worker. Never mutate the shared execution reconciler. `bun test` is an implementation gate, not this non-test-only ticket's user journey; not run by this driver.

## Setup

Implementer handoff was literal `null`. Parent reported `mise run setup` complete. Initial `bun lib/reconcile/main.ts --help` reached command usage, not a recovery scenario; initial report was blocked. Existing [handoff friction](../../issues/supervised-study-drive-lacks-setup-handoff.md) updated.

Supervisor then authorized a disposable scratch repo and explicit branch CLI, live restart, missing-state-bb experiment, graph/session metadata observation and cleanup. Created `/tmp/bb-worker-drive-Z0zQHv` (physical `/private/tmp/...`), initialized Git, and created two trivial tickets through tracker CLI. Persona: local orchestration user, owner `thr_9nefarij38`; no additional authentication or external services. Workers write a committed text file after an initial managed pause. Only scratch state was edited.

Runnable entry (replace scratch path and ticket when replaying):

```sh
bun <reviewed-checkout>/lib/reconcile/main.ts start identity-first --owner "$BB_THREAD_ID" --budget 1 --land local --cwd <scratch>
bun <reviewed-checkout>/lib/reconcile/main.ts status --cwd <scratch>
```

Readiness was established by successful start receipt, scratch-local state/log, bb thread identity and ready worktree, not merely installation completion.

## Actions and observations

### Identity and ordinary restart — held

`identity-first` started reconciler pid 9663. State receipt held run `identity-first`, handle `identity-first-implement-1`, bb `thr_5ikt6x65id`, threadId `d5a03d62-b9f9-4007-a469-3dd7778956bc`. bb showed exact title `identity-first/identity-first-implement-1` and ready scratch-owned worktree.

Killed only pid 9663 with SIGKILL while the worker was live, then restarted (pid 12134). Same receipt remained, no second implement worker. Killed pid 12134, deleted `chains.identity-first.handle.bb` from scratch state, restarted (pid 12565): original bb id was restored. The separate dispatch receipt still existed in this first experiment.

The original worker subsequently completed commit `9fd9f1c364d5fe87bfec9e36cef89f806273f2d0`. Reconciler advanced through drive (`thr_w6pj4hw86z`) and review (`thr_yfcg6v6v4z`), landed the result, and reached `finished: done` with no exceptions. `git show HEAD:hello.txt` in scratch printed `hello`. The live driver repeated the setup pause unnecessarily; steered it to stop its own delay and clarified the scratch ticket so reviewers would not repeat it.

### Missing bb recovery — held for authorized simulation; full lost-receipt claim unobservable

Second ticket `identity-restart` started pid 14844 with worker `thr_wnikkjqqrq`, title `identity-restart/identity-restart-implement-1`. Killed only pid 14844 during its managed pause. Removed `bb` from both `chains.identity-restart.handle` in `.git/reconcile/identity-restart.json` and `.git/ab-dispatch/identity-restart-identity-restart-implement-1.json`. Restarted (pid 16385). State restored **the same** `bb: thr_wnikkjqqrq`. Filtered bb child list showed exactly one implement worker per run, no duplicates. Original second worker completed commit `857cc1375603727669565b07dc0308a2b2b992f5`, reporting `restart.txt` contains `reattached`.

This follows the supervisor's field-deletion simulation. It does **not** establish recovery of a worker wholly absent from state: run/handle/path/threadId remained. The broader ticket claim remains unobservable, not disproved.

### Notice delivery — owner completion held; routine filtering not accepted

Owner queue contained `qmsg_kuer8m24u2`: `[reconcile identity-first] done: identity-first landed in the owner's checkout at c2fa4e9`, waiting because owner was busy. Thus final reconciler notice reached the correct owner queue.

Routine worker notices also reached the driver's conversation: owner event seq 228 (implement waiting), 385 (implement done), 426 (drive done), 442 (review done). Expected suppression was **not met in the encountered runtime**. The reconciler was branch-pinned, but the owner was this already-running pi session; its extension revision was not established. Therefore this is not a proven defect in the branch filter and that claim remains unobservable on the reviewed revision. Existing [extension revision friction](../../issues/drive-pi-extensions-from-reviewed-worktree.md) updated with these observations. No shared runtime reloaded.

### Graph and session metadata — identity held; field-removal expectation failed

Public export introspection exposed `graph`, `findNode`, `spawnMeta`, `install`. `graph()` returns a Map; initial JSON.stringify misleadingly produced `{}`. Used `JSON.stringify([...((await graph()).values())].filter(n => n.cwd?.includes("bb-worker-drive-Z0zQHv")), null, 2)` from this branch's direct import.

Live bb node `01a152c8-e5c8-703d-a023-6232dbd77a3b` described the first worker with run `identity-first`, handle `identity-first-implement-1`, thread `thr_5ikt6x65id`, state `idle`. It retained **`interactive: false`**, contrary to the literal removed-fields prediction. It had none of seenAt/attention/terminals/delta in the JSON output. A second empty launch-session node existed at the same cwd, id `d5a03d62-b9f9-4007-a469-3dd7778956bc`, with `interactive: true`; no duplicate bb worker existed.

Direct `spawnMeta()` in the scratch worker cwd with explicit `PI_WM_RUN=identity-first PI_WM_HANDLE=identity-first-implement-1` returned matching run/handle (and inherited agent verify). This observes the public helper, not the session-start extension's persisted metadata or absence of registry reads. Persistence and internal storage independence remain unobservable without implementation inspection, which belongs to review.

## Replayable checks and final outcomes

- **Held:** launch, inspect receipt/state and bb title/path; require bb id/run/handle to match.
- **Held:** kill only owned reconciler pid during worker pause, restart with same CLI; require same implement bb id, no extra same-title thread and successful original-worker report handling.
- **Held, bounded simulation:** remove bb from scratch state and dispatch receipt, restart; require original bb id restored. **Unobservable:** a wholly lost run-state receipt.
- **Held:** allow full run to finish, inspect owner queue; require final landed notice for that root.
- **Unobservable on branch:** repeat routine completion with a branch-pinned owner extension; require no child routine notice while final root notice still arrives. Encountered runtime did deliver routine notices.
- **Failed literal field-removal expectation:** direct graph import for owned worker; run/handle/thread present but interactive remains. Reviewer must decide whether the ticket intended removal from graph's public output or only the retired record shape.
- **Unobservable:** session-start metadata persistence and registry-read independence; helper invocation alone is not sufficient.
- **Unobservable here:** bun test passes; reviewer/integration gate owns this measurement.

## Cleanup

Stopped `identity-restart` via checkout CLI after recovery/report observation (its next drive worker had started), and stopped `identity-first` after observing finished done and the final owner notice. CLI reported both not running. All five scratch child threads were already archived by retirement; explicitly stopped each to release runtimes. Verified scratch worktree directory empty and Git listed only the scratch main checkout. Deleted the scratch repo and empty worktree directory. Removed only the six synthetic scratch-run notices from this driver's queue after recording them. All managed monitors finished. No shared reconciler, deployment or data touched; no owned resource remains running.
