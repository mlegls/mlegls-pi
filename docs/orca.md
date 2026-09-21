# Orca execution and coordination

Orca is the execution backend in every client. Exec disables `wm` and `board`, even in explicit allowlists; the board host is no longer loaded. Legacy libraries remain importable for rollback, not advertised as active APIs. Module selection is not a sandbox.

## Setup and identity

Run the Orca app and register the project. `/reload` Pi after upgrading this package. `lib/orca.ts` is auto-loaded as `orca` in normal exec cells; the reader profile excludes it. `ORCA_CLI` overrides the executable; otherwise the Orca environment/platform conventions apply. `PI_ORCA_COMMAND` overrides the trusted Pi shell command.

Inside an Orca terminal, the CLI resolves the calling terminal. Outside Orca, use `/fork-tab [title]` to open a sibling conversation in an explicitly managed checkout, or pass the real coordinator terminal handle as `from` (`terminal` for `check`). Never use the focused tab as an implicit identity. A Run is bound to a coordinator terminal; saving only its ID does not grant another caller that role. `runs.use({id, from?})` explicitly rebinds it.

## Known unavailable providers

Keep availability separate from usage ceilings. After a positively observed billing
or authentication failure, record the exact catalog provider in a coordinator-owned
map and pass it to every subsequent `route.prepare` or `route.route` call:

```ts
state.routing = { unavailableProviders: {} as Record<string, string> }; // once per run
state.routing.unavailableProviders.openai = "Account reports no credits remaining";
const assignment = await route.prepare("Implement the agreed slice", state.routing);
// After credentials/credits are repaired, explicitly restore eligibility:
delete state.routing.unavailableProviders.openai;
```

An exclusion removes all models for that provider before judgment; it does not
exclude another provider such as `openai-codex`. Reasons are retained in the
routing receipt. All excluded means a local routing error, not a selection call. Unknown
telemetry is still eligible. The map belongs to the run/account context: preserve
it in the handoff if continuing after a kernel reset; do not carry it to a different
credential context. There is no guessed expiry or global blacklist. Availability
is coordinator-reported, not inferred from timeouts or parsed automatically from
worker prose. This affects future selection only: it neither cancels nor retries
an existing Dispatch.

## Interactive addresses

Interactive Pi tabs inside Orca automatically create a Run when their terminal has no binding or active Dispatch. The footer shows the full `run:<id>` address; `/orca-address` prints it in the conversation for copying. The same address is supplied to the agent on each turn. Reloading preserves the terminal's binding; a new tab (including `/fork-tab`) gets its own. Switching conversations in the same terminal keeps that terminal's address. This is not portable session-file identity: reopening the file in another terminal does not take over the old Run.

Tell another session to message the displayed address:

```ts
await orca.send({to: "run:<id>", subject: "Coordination", body: "…"});
```

Existing workers display `dispatch:<id>` instead of creating a Run. Pi launches carrying `PI_ORCA_START_TOKEN` defer address creation while enrollment is pending. No mailbox is consumed automatically: use `orca.check()`, process the returned batch, then acknowledge it. Incoming-mail notifications remain separate; enqueue does not guarantee attention.

Address lookup failures show `orca: unavailable`. A failed creation is not automatically retried; later polls can discover a binding created despite a lost response. Inspect Orca before reloading to retry an uncertain creation.

## Supervision from exec

Load the installed contract with `orca skills get orchestration`. The TypeScript wrapper preserves native receipts rather than synthesizing a worker state machine. For fresh assignments, use `route.prepare` to select stance, model, and effort, then [`dispatch.dispatch`](dispatch.md) to launch the prepared work. The launcher handles the Pi start-before-enrollment workaround internally; it is not a reason to choose a model manually.

```ts
state.run = (await orca.runs.create({objective: "Implement the agreed slice"})).run;
const task = "Self-contained assignment, context, ownership, acceptance…";
const execution = await route.prepare(task);
if (execution.kind === "triage") throw new Error("Prepare a decision-session handoff first");
state.launch = notify(dispatch.dispatch([
  {handle: "unit-a", prompt: task, ...execution},
], {run: state.run.id, maxConcurrent: 3, active: []}), "dispatch");
```

In a later cell, retain the full wave receipt with `state.wave = await state.launch`. Inspect `failed` and `pending` before proceeding; do not relaunch submitted workers. Each `state.wave.submitted` entry contains a `receipt` preserving `taskId`, `dispatchId`, launch effects, and the runtime’s readiness evidence. Set `state.worker` to the receipt being inspected. For later waves, pass all outstanding handles in `active` and serialize submissions. `ready/input_accepted` is not proof that Pi began a turn. Check `state.worker.startConfirmation.status`: only `started` has positive worker-side evidence; `unconfirmed` is a launch error: inspect the retained dispatch, not resubmit or wait for completion.

### Low-level launch escape hatch

`workers.submit` and `startPi` execute supplied model/effort values; they do not call autoroute or enforce routing provenance. Use them directly only when the prepared-wave launcher does not fit or when explicitly testing launch mechanics. Normal assignments still require routing first.

`workers.submit({spec, model, effort, …})` creates a Pi terminal and submits its assignment in one invocation. Before enrollment it requires the child extension’s `session_start` evidence, then waits for native `terminal wait --for tui-idle` to report `satisfied: true`, bounded by `timeoutMs` (default 60000). A timeout or missing readiness preserves the terminal and submits no assignment; inspect that terminal rather than launching another. After enrollment it waits up to `startWaitMs` (default 5000) for the Pi extension’s correlated `before_agent_start` event. This proves entry into the assigned turn, not a successful model response or ongoing progress. Evidence is retained in a private temporary directory named in `startConfirmation.evidencePath`. Recheck later with `await orca.workers.confirmStart(state.worker, 5000)`; this neither resends work nor consumes mail. The event observer must be installed in the child. Missing startup evidence prevents enrollment. Missing turn-start evidence throws `OrcaError` with the full worker receipt (including native IDs and `clientTerminal`) in `error.receipt`; it does not return success. `confirmStart(error.receipt, 5000)` re-observes and updates that receipt. Neither error authorizes retry. In a wave, the launch stops at `failed`; later assignments stay `pending`, and the retained attempt still occupies capacity until resolved. Native `terminal send --wait-submit` is not a standalone observation call: it requires text and Enter. Do not repeat an accepted prompt just to observe it. Native `workers.start` remains available and conservatively returns unconfirmed; task-ID-only `startPi` launches correlate against the Task ID in the injected preamble.

### Completion and cleanup

```ts
state.mail = notify(orca.check({run: state.run.id, wait: true,
  types: ["worker_done", "question", "escalation"]}), "worker mail");
// Later:
state.delivery = await state.mail;
await show(state.delivery);
```

Process **every** message in the returned batch. Reply to questions with `orca.reply({id, body})`; validate outcomes against the expected Dispatch. Reuse, explicitly retain, or release each settled worker. Then `state.next = await orca.ack(state.delivery.deliveryId, {run: state.run.id})`. Ack can return another delivery: handle it rather than discarding it. Reads, display, and notifications never acknowledge mail. Type filters select when to wake, not which messages in the FIFO delivery to process.

`workers.show(dispatchId)`, `workers.read({dispatch, source: "auto"})`, and `workers.list({run, includeRemote: true})` preserve Orca’s observations and pagination. A timeout, contact loss, or null agent state is not proof of exit. `workers.stop({dispatch})` and `workers.abandon({dispatch})` are explicit recovery operations, not automatic timeout handlers. Load the installed recovery guide before using them. Orca terminal handles are not exec `term` session IDs: use `workers.read` or `orca.call(["terminal", "read", "--terminal", handle])`, not `term.view(handle)`. A tmux lookup failure says nothing about Orca worker liveness.

CLI failures throw `OrcaError` with the complete parsed envelope in `.receipt`, including residual resources and recovery commands. Unknown mutation outcomes are not retried. Long waits use a CLI timeout longer than the native wait; retain them with `notify` to avoid the exec cell deadline. Kernel reset can interrupt the CLI without undoing its mutation. Reinspect Orca; inbox batches remain durable until acknowledged.

### stop_unknown recovery

On Orca 1.4.206, stopping a caller-owned Pi terminal can return
`state: stop_unknown`, `processAction: none`, and
`lastError: "The worker terminal is external; no terminal was closed."`
This is not successful cancellation. Native release then refuses settlement and
misleadingly recommends stop again; a repeated stop can itself refuse. The local
adapter adds recovery guidance to these errors and keeps the native `.receipt`
unchanged.

1. Inspect `workers.show(dispatch)`, `workers.read({dispatch})`, and run-scoped
   `workers.list({run, includeRemote: true})`. Preserve the actual terminal identity
   and execution host. Silence or an unavailable host is not exit evidence.
2. With positive proof the agent stopped (not merely an idle PTY), explicitly
   `workers.abandon({dispatch, reason: "<observed evidence>"})` to fence the attempt.
   If liveness remains uncertain, retain the resources and investigate instead.
3. Abandon performs no process action. After accepted settlement, handle release
   and any caller-owned terminal cleanup separately, checking that the terminal
   has no new owner. An uncertain release is not permission to close it.
4. A replacement requires an explicit retry decision and the original Task and
   `retryOf` lineage; never replay an accepted prompt on the strength of this error.

This is an adapter recovery fix, not a change to native Orca ownership semantics.

## Pi model selection

Orca 1.4.206 accepts `worker-start --agent pi`, but rejects Pi launch-time model/effort selection. `orca.startPi({spec, run?, from?, worktree?, model, effort, taskTitle?})` launches a Pi terminal with native Pi flags, then enrolls it with `worker-start --terminal`. It requires an exact existing workspace selector; create a workspace first for separate checkouts. Worktrees separate Git state, not filesystem permissions; they do not prevent writing the canonical checkout. It returns the native receipt plus `clientTerminal`. A failed enrollment preserves the terminal and reports it in the error receipt.

That terminal is **caller-owned**. Orca’s `workers.release(dispatchId)` will not close a pre-existing terminal. After accepted settlement and integration, inspect the release receipt, then explicitly `orca.stop(receipt.clientTerminal.handle)` if that terminal has no new owner. Remove an isolated worktree separately after merging. Direct native `workers.start({agent: "pi", …})` avoids this ownership gap but uses Pi’s defaults; it is not a substitute for executing the routed model/effort selection.

Prepared, routed waves use [`dispatch.dispatch`](dispatch.md); this helper creates nested worktrees and uses the selected-model enrollment path.

## Messaging

`orca.send({to, subject, body, type?, threadId?, payload?})` supports direct `dispatch:<id>`, `run:<id>`, and native group addresses. Most groups cover live dispatches in the sender’s Run; `@worktree:<id>` is workspace-scoped. This is addressed mail, not arbitrary topic subscriptions. Copy lifecycle IDs, sender identity, and capability arguments from the live injected worker preamble. Orca 1.4.206’s `dispatch-show --preamble` omits the capability; do not use it to reconstruct lifecycle authority.

`orca.ask({question, …})` blocks for a reply; timeout leaves the question pending, resumable with `{resume: messageId}`. Retain long asks with `notify`. Native wake/nudge is best effort, not proof of processing; workers check their mailbox at checkpoints. There is no additional Pi polling adapter in this version.

## Conversation forks and readers

`/fork-tab [title]` forks the persisted session at the selected leaf into another focused Pi terminal in the same checkout. It leaves the source conversation in place and creates no Task/Dispatch. Normal `/fork` is unchanged. Use separate worktrees for conflicting edits.

`autoread.run` defaults to Orca even outside Orca; `{backend: "pi"}` explicitly selects a private local reader. Readers and forks are not supervised tasks. Reader PTYs stop on completion/cancellation; session/result files remain durable, terminal handles do not.

## Verification

See [native lifecycle verification](research/orca-native-coordination-2026-09-21.md). Remote execution, app restart, image rendering, and native Pi status-hook parity remain separate checks.
