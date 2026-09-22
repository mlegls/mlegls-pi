# Dispatch a ready wave

`dispatch.dispatch` launches prepared Pi assignments through Orca in every client. The supervisor owns decomposition, admission (`route.prepare`), integration, and concurrency. Orca owns the Run, Task, Dispatch, and mailbox lifecycle. See [Orca](orca.md) for the direct API and coordinator identity requirements.

```ts
state.run = (await orca.runs.create({objective: "Implement feature X"})).run;
const task = "Self-contained assignment, context, interfaces, ownership, acceptance…";
const execution = await route.prepare(task);
if (execution.kind === "triage") throw new Error("Prepare a decision-session handoff first");
state.launch = notify(dispatch.dispatch([
  {handle: "unit-a", prompt: task, ...execution},
], {run: state.run.id, maxConcurrent: 3, active: []}), "dispatch");
```

Later: `state.wave = await state.launch`. `run` must be an existing Orca Run ID, not a topic prefix. Outside an Orca coordinator terminal, pass its real handle as `from`. For later waves, pass all outstanding handles supervised by this parent in `active`. This is a parent-scoped budget, not a global scheduler. Serialize wave submissions. Excess assignments remain `pending`.

Assignments require `handle`, self-contained `prompt`, `model` (`provider/model`), and `effort`; optional `agent` names a roster stance, not an Orca agent preset. Optional `base` selects an exact Git ref. Omission uses Orca’s default base, not uncommitted parent changes. The helper creates explicitly nested worktrees, requests setup, enrolls a caller-owned bootstrap terminal through native `dispatch --return-preamble`, then starts Pi with model/effort and the assignment as a prompt-file argument. No assignment is typed into Pi’s editor. Native dispatch supplies Task/Dispatch/mail identity but does not supervise the process; terminal cleanup remains caller-owned.

## Receipts and lifecycle

- `submitted`: `{backend: "orca", handle, worktreeId, path, receipt}`. `receipt` retains native `runId`, `taskId`, `dispatchId`, effects, and `clientTerminal`, plus `startConfirmation`. Only confirmed starts enter `submitted`. Only `startConfirmation.status === "started"` proves entry into the assigned Pi turn; re-observe with `orca.workers.confirmStart(receipt)` without resubmitting.
- `failed`: the first failed assignment, error text, and structured error receipt where available. Earlier launches survive; residual resources are retained for inspection. An unconfirmed turn start stops the wave here, with its full worker receipt under `failed.receipt.cause`. Re-observe that receipt with `orca.workers.confirmStart`; do not resubmit the assignment or wait for its completion without start evidence. Resolve the retained attempt before launching another wave: it still consumes capacity.
- `pending`: never-attempted assignments. The parent decides when to launch them.

Routing happens before launch: `dispatch.dispatch` consumes the `route.prepare` result, while `startPi` handles Pi launch and enrollment internally. Neither launcher chooses a model; explicit assignment constraints are rechecked before launch; do not replace admission with manual selection to work around native Orca launch limitations.

No implicit retries, dependency scheduling, merging, or cleanup. Use `notify` for launch and mailbox waits. Worker instructions receive Orca’s authoritative lifecycle preamble; board topics and subscriptions are not involved.

Consume `orca.check` deliveries, answer questions, validate completion against the Dispatch, and decide terminal ownership before acknowledging. Merge with Git or Orca. These model-selected Pi terminals are pre-existing from Orca’s perspective: native release retains them. After settlement/integration, explicitly close the caller-owned terminal if unused, then remove the worktree. Native `orca.workers.start` offers runtime-owned terminals but uses Pi’s defaults rather than applying the routed model/effort selection.

## Session boundaries

Use `route.continuation({ current: { model, effort }, assignment, report, remaining, context, handoff }, options)` at an exception or context checkpoint. Include measured cache use or known handoff size in that evidence when available; missing facts stay unknown.

- `continue`: retain the current session/model and relevant context.
- `consult`: prepare a bounded question and evidence packet; `route.prepare` it (recorded `session-triage` for decisions outside delegated authority), launch a separate session, then return its decision to the warm worker.
- `replace`: preserve commits and outstanding work, update the issue, and prepare a compacted/OM-backed handoff. Admit and launch a new session from the intended base; stop the old worker before transferring write ownership. Retire it after the handoff is secured.

A `prepare` result with `kind: "triage"` supplies the selected model/effort but no agent. Launch a new session with the explicit decision question, evidence, and requirement to update the issues; do not dispatch the original implementation prompt. Re-admit execution after the decision.

These tools do not transfer memory, compact history, change models in place, manage dependencies, or terminate workers. Save their returned judgments with the assignment/report when evaluating cost to accepted completion, including repair and escalation.

## Routing API

`await route.prepare(taskWithContext, { assignee?, stance?, policyPath?, usage?, unavailableProviders? })` admits a **fresh** assignment. Include the issue contract, dependencies/ownership, relevant evidence, capability needs, and handoff/context facts. Supply `stance` when already recorded; otherwise Jev selects from Assignment stances. Returns `kind: "ready"`, `agent`, `stance`, `judgment`, and the model selection fields below. A `kind: "triage"` result has no worker agent: use the selected model for a new decision session, not the original implementation assignment. `judgment` is null for a recorded stance.

`await route.continuation(context, { policyPath?, usage? })` returns `action`, `p`, `dist`, and `policyPath`. Supply current model/effort, assignment, latest report, remaining work, context relevance, and available cache/handoff evidence. It only advises continue/consult/replace: it never switches models, compacts, launches, or closes sessions. For consult/replace, prepare the actual handoff and admit it with `prepare`; do not route the old full transcript again.

`await route.route(workflow, task, { policyPath, usage })` in exec; both options are optional. `usage` is a provider-keyed map of normalized fractions or null. The default policy path is this package’s root `routing.md`, independent of the current directory.

Returns `model`, `effort`, winning probability `p`, and `dist` keyed by `provider/model@effort`, plus `policyPath` and the supplied usage snapshot. Probabilities compare alternatives, not overall correctness; no uncalibrated confidence gate is imposed.

CLI: `bun lib/route.ts <workflow> <task text> [policy-path]`.

## Maintaining routing policy

`routing.md` is input to the router, not documentation for its callers. `lib/route.ts` reads it at call time; edits need no reload and no Obsidian notes are loaded. Keep decision criteria and model guidance there, including observed workflow costs and evidence provenance. Prices and model opinions are guidance, not capability guarantees.

The Assignment stances and Continuation actions sections use machine-read bullets of the form "- \`label\`: criterion". Catalog bullets name Pi model IDs in backticks as `provider/model` and their effort sets; those pairs define the candidate set. Obtain IDs from `pi --list-models`.

Usage is supplied by the caller as a fraction of each provider’s routing ceiling, not necessarily its full quota. The router does not fetch usage or reserve capacity.

## Tracker assignment

Pass each issue's own `assignee` to `route.prepare`, even when absent. Omission of the option is reserved for non-tracker calls; an explicitly absent value is unassigned and refuses automatic routing. Pass `issue` and the returned `assignee` into dispatch. Re-read child assignments during recursive decomposition: a parent's selector is not inherited permission.

- `agent`: ordinary agent admission.
- `agent:fill`: the named prompt/workflow and its policy model (the implementation operating point where defined).
- `model:zai/glm-5.3-flash:high`: exact execution; prompt/workflow still comes from admission or a supplied stance.
- `agent:fill, model:zai/glm-5.3-flash:high`: that workflow with an explicit model override. Component order is immaterial.
- `human`, `user:<name>`, `session:<id>`: not fresh agent admission. Hand to the human or recover/resume the exact assigned session; changing context requires explicit reassignment.

Bare aliases, short model names, duplicate selectors, unknown models/efforts and unavailable assigned providers are errors, never fallback hints. Catalog availability is policy plus caller-supplied provider exclusions/ceilings, not an authenticated provider health probe. Generic agent routing retains normal policy selection. Direct `orca.startPi` calls can carry `assignee` and `agent` for the same launch checks; they do not install the stance prompt for the caller.
