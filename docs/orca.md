# Orca execution and coordination

Orca is the execution backend in every client. Exec disables `wm` and `board`, even in explicit allowlists; the board host is no longer loaded. Legacy libraries remain importable for rollback, not advertised as active APIs. Module selection is not a sandbox.

## Setup and identity

Run the Orca app and register the project. `/reload` Pi after upgrading this package. `lib/orca.ts` is auto-loaded as `orca` in normal exec cells; the reader profile excludes it. `ORCA_CLI` overrides the executable; otherwise the Orca environment/platform conventions apply. `PI_ORCA_COMMAND` overrides the trusted Pi shell command.

Inside an Orca terminal, the CLI resolves the calling terminal. Outside Orca, use `/fork-tab [title]` to open a sibling conversation in an explicitly managed checkout, or pass the real coordinator terminal handle as `from` (`terminal` for `check`). Never use the focused tab as an implicit identity. A Run is bound to a coordinator terminal; saving only its ID does not grant another caller that role. `runs.use({id, from?})` explicitly rebinds it.

## Supervision from exec

Load the installed contract with `orca skills get orchestration`. The TypeScript wrapper preserves native receipts rather than synthesizing a worker state machine.

```ts
state.run = (await orca.runs.create({objective: "Implement the agreed slice"})).run;
state.launch = notify(orca.workers.start({
  run: state.run.id, spec: "Self-contained assignment, context, ownership, acceptance…",
  agent: "pi", worktree: orca.workspace(),
}), "worker launch");
```

In a later cell, retain the full launch receipt. `state.worker = await state.launch` preserves `taskId`, `dispatchId`, launch effects, and the runtime’s readiness evidence. `ready/input_accepted` is not proof that Pi began a turn.

```ts
state.mail = notify(orca.check({run: state.run.id, wait: true,
  types: ["worker_done", "question", "escalation"]}), "worker mail");
// Later:
state.delivery = await state.mail;
await show(state.delivery);
```

Process **every** message in the returned batch. Reply to questions with `orca.reply({id, body})`; validate outcomes against the expected Dispatch. Reuse, explicitly retain, or release each settled worker. Then `state.next = await orca.ack(state.delivery.deliveryId, {run: state.run.id})`. Ack can return another delivery: handle it rather than discarding it. Reads, display, and notifications never acknowledge mail. Type filters select when to wake, not which messages in the FIFO delivery to process.

`workers.show(dispatchId)`, `workers.read({dispatch, source: "auto"})`, and `workers.list({run, includeRemote: true})` preserve Orca’s observations and pagination. A timeout, contact loss, or null agent state is not proof of exit. `workers.stop({dispatch})` and `workers.abandon({dispatch})` are explicit recovery operations, not automatic timeout handlers. Load the installed recovery guide before using them.

CLI failures throw `OrcaError` with the complete parsed envelope in `.receipt`, including residual resources and recovery commands. Unknown mutation outcomes are not retried. Long waits use a CLI timeout longer than the native wait; retain them with `notify` to avoid the exec cell deadline. Kernel reset can interrupt the CLI without undoing its mutation. Reinspect Orca; inbox batches remain durable until acknowledged.

## Pi model selection

Orca 1.4.206 accepts `worker-start --agent pi`, but rejects Pi launch-time model/effort selection. `orca.startPi({spec, run?, from?, worktree?, model, effort, taskTitle?})` launches a Pi terminal with native Pi flags, then enrolls it with `worker-start --terminal`. It requires an exact existing workspace selector; create a workspace first for isolation. It returns the native receipt plus `clientTerminal`. A failed enrollment preserves the terminal and reports it in the error receipt.

That terminal is **caller-owned**. Orca’s `workers.release(dispatchId)` will not close a pre-existing terminal. After accepted settlement and integration, inspect the release receipt, then explicitly `orca.stop(receipt.clientTerminal.handle)` if that terminal has no new owner. Remove an isolated worktree separately after merging. Direct native `workers.start({agent: "pi", …})` avoids this ownership gap when Pi’s default model is suitable.

Prepared, routed waves use [`dispatch.dispatch`](dispatch.md); this helper creates nested worktrees and uses the selected-model enrollment path.

## Messaging

`orca.send({to, subject, body, type?, threadId?, payload?})` supports direct `dispatch:<id>`, `run:<id>`, and native group addresses. Most groups cover live dispatches in the sender’s Run; `@worktree:<id>` is workspace-scoped. This is addressed mail, not arbitrary topic subscriptions. Copy lifecycle IDs, sender identity, and capability arguments from the live worker preamble.

`orca.ask({question, …})` blocks for a reply; timeout leaves the question pending, resumable with `{resume: messageId}`. Retain long asks with `notify`. Native wake/nudge is best effort, not proof of processing; workers check their mailbox at checkpoints. There is no additional Pi polling adapter in this version.

## Conversation forks and readers

`/fork-tab [title]` forks the persisted session at the selected leaf into another focused Pi terminal in the same checkout. It leaves the source conversation in place and creates no Task/Dispatch. Normal `/fork` is unchanged. Use separate worktrees for conflicting edits.

`autoread.run` defaults to Orca even outside Orca; `{backend: "pi"}` explicitly selects a private local reader. Readers and forks are not supervised tasks. Reader PTYs stop on completion/cancellation; session/result files remain durable, terminal handles do not.

## Verification

See [native lifecycle verification](research/orca-native-coordination-2026-09-21.md). Remote execution, app restart, image rendering, and native Pi status-hook parity remain separate checks.
