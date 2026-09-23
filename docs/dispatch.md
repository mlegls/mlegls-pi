# Prepared dispatch

The parent owns decomposition, dependencies, admission (`route.prepare`), concurrency and acceptance. `dispatch.dispatch` only launches prepared assignments. Host selection is local: `PASEO_AGENT_ID` → Paseo; otherwise an Orca workspace environment → retained Orca adapter; otherwise workmux/board. Paseo takes precedence over inherited Orca variables.

```ts
show(state.launch = dispatch.dispatch([
  { handle: "unit-a", prompt: "Self-contained assignment, context, constraints and completion criterion",
    agent: "auto", model: "openai-codex/gpt-6-sol", effort: "high", base: "<exact Git ref>" }
], { run: "feature-x", maxConcurrent: 2, active: [] }));
```

Later retrieve `state.wave = await state.launch`. Serialize submissions and pass **all outstanding** handles in `active`, across waves. `maxConcurrent` is required on every backend; it is a parent-scoped budget, not a daemon-wide limit or queue. Excess assignments remain `pending`. An uncertain launch must be resolved before the next wave; it may still consume capacity.

Assignments require `handle`, self-contained `prompt`, `model` (`provider/model`), and `effort`. Optional `agent` names a roster stance, not a host preset. Optional `base` passes the exact Git ref to the host; omission uses the host default, not uncommitted parent changes. The entire wave is validated before the first launch, including issue/assignee constraints below. No implicit retries, routing, dependency scheduling, or inherited issue ownership.

The receipt contains:

- `submitted`: native handles for successful launches. Paseo: `{backend: "paseo", handle, agentId, workspaceId, path, receipt: {workspace, agent}}`; workmux: `{backend: "wm", handle, path, worker}`; Orca retains `{backend: "orca", handle, worktreeId, path, receipt}`.
- `failed`: first failed assignment, error text and available native/raw receipt. Earlier launches survive. Inspect the retained attempt, including retained SDK snapshots and request correlation IDs, before deciding what to do. Creation can succeed before a client timeout or parse failure.
- `pending`: assignments never attempted, because of capacity or the earlier failure.

## Paseo

See [the SDK boundary and setup](paseo.md). Workspace creation and agent launch are separate SDK requests so a launch failure retains the workspace ID. Launch uses native Pi config `provider: "pi/PROVIDER/MODEL"`, an explicit parent from `PASEO_AGENT_ID`, and a data prompt. `none` maps to Pi native `off`; other effort IDs pass unchanged. `PASEO_URL`/`PASEO_PASSWORD` select the connection; the default is the local desktop daemon. CLI host configuration is not consulted.

The prompt includes the roster stance, assignment, parent ID and reporting convention. Supervise through `paseo.withClient(c => c.agents.ref(ID).waitForFinish())`, `.timeline.refetch()` and `.send(message)`; show long waits and the outcome arrives by handle. Parent is only the `paseo.parent-agent-id` label: SDK-created children never wake the parent (Paseo's `notifyOnFinish` is MCP `create_agent` only), so the parent waits on them itself. A completed turn is not assignment completion: read the report, answer questions, and check the assignment criterion. Workers end the turn with `done`, `blocked`, or `needs-input` first (`lib/report.ts`); a question is a `needs-input` turn end, answered by the next message. There is no additional inbox/ack or task-record layer. CLI `wait`, `logs`, and `send --no-wait` remain manual recovery tools.

## Standalone and retained Orca

Standalone uses `wm.spawn` with the selected model/effort, stance, base and board reporting. Retain its Worker object for supervision and cleanup.

Inside Orca, `run` must be an existing native Run ID; `from` can identify the real coordinator terminal. The existing enrollment, authoritative preamble, start-confirmation and partial-receipt behavior is unchanged. Only confirmed starts enter `submitted`; inspect `failed.receipt.cause` and use `orca.workers.confirmStart` rather than resubmitting an uncertain start. See [Orca lifecycle](orca.md). Those requirements do not apply to Paseo or standalone.

## Integration

After the worker is settled and completion is accepted, `dispatch.integrate(handle, {cwd?, mode?, keep?})` uses plain Git. It refuses uncommitted worker changes. Default `mode: "rebase"` rebases onto parent HEAD and fast-forwards; `mode: "merge"` makes a `--no-ff` merge commit. Conflicts abort and throw `MergeConflict` with `branch` and `files`; send those to the worker to resolve on its branch. The caller owns settlement and acceptance; integration does not infer them from idle status.

`keep: true` stops after Git integration. Otherwise cleanup happens **after** integration: Paseo archives the retained workspace ID; workmux closes the retained Worker; Orca releases the Dispatch, closes the worktree's terminals and removes its worktree. Native receipts are returned in `Integration`. Cleanup is sequential, not transactional: if archive/cleanup fails after the merge, the merge remains. Inspect native state before repeating cleanup. No archive is attempted on merge failure.

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
