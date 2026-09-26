# Prepared dispatch

The parent owns decomposition, dependencies, admission (`route.prepare`), concurrency and acceptance. `dispatch.dispatch` only launches prepared assignments, each as a `wm` worker: a workmux worktree and tmux window running pi, reporting on board topic `<run>/<handle>`.

```ts
show(state.launch = dispatch.dispatch([
  { handle: "unit-a", prompt: "Self-contained assignment, context, constraints and completion criterion",
    agent: "auto", model: "openai-codex/gpt-6-sol", effort: "high", base: "<exact Git ref>" }
], { run: "feature-x", maxConcurrent: 2, active: [] }));
```

From bash, the same call takes JSON arguments: `ab lib dispatch dispatch '[{"handle":"unit-a",…}]' '{"run":"feature-x","maxConcurrent":2,"active":[]}' > receipt.json`. It prints the receipt; a long launch arrives as a late result.

Later retrieve `state.wave = await state.launch`. Serialize submissions and pass **all outstanding** handles in `active`, across waves. `maxConcurrent` is required; it is a parent-scoped budget, not a daemon-wide limit or queue. Excess assignments remain `pending`. An uncertain launch must be resolved before the next wave; it may still consume capacity.

Assignments require `handle`, self-contained `prompt`, `model` (`provider/model`), and `effort`. Optional `agent` names a roster stance, not a host preset. Optional `base` passes the exact Git ref to the host; omission uses the host default, not uncommitted parent changes. The entire wave is validated before the first launch, including issue/assignee constraints below. No implicit retries, routing, dependency scheduling, or inherited issue ownership.

The receipt contains:

- `submitted`: `{handle, run, path}` per launch, plain data you can persist; `dispatch.topic(h)` is its board topic and child ID, and `wm.attach(run, handle)` rebuilds the Worker.
- `failed`: first failed assignment and error text. Earlier launches survive. Inspect the worktree workmux may have created before deciding what to do.
- `pending`: assignments never attempted, because of capacity or the earlier failure.

## Supervision

Workers report by ending their turn: the last message starts with `done`, `blocked`, or `needs-input` (`lib/report.ts`), posted on `<run>/<handle>`. Dispatch doesn't subscribe the parent; `board.subscribe({ topic: "<run>/*", tags: "done | blocked | needs-input | checkpoint" })` makes reports wake it, or wait with `children.turnEnd([topic(h), …])`. `children.send(topic, text)` answers a question or steers a worker. A completed turn is not assignment completion: read the report, answer questions, and check the assignment criterion.

## Integration

After the worker is settled and completion is accepted, `dispatch.integrate(handle, {cwd?, mode?, keep?})` uses plain Git. It refuses uncommitted worker changes. Default `mode: "rebase"` rebases onto parent HEAD and fast-forwards; `mode: "merge"` makes a `--no-ff` merge commit. Conflicts abort and throw `MergeConflict` with `branch` and `files`; send those to the worker to resolve on its branch. The caller owns settlement and acceptance; integration does not infer them from idle status.

`keep: true` stops after Git integration. Otherwise cleanup happens **after** integration: workmux removes the worker's window and worktree. Processes still running from inside the worktree (a `term.spawn` tmux server, a dev server) are sent SIGTERM (`killed`); workmux doesn't reach them. Then the worker's branch is deleted when all its patches are in HEAD (`git cherry`, since rebasing rewrites commits; `branchDeleted`); if it is unmerged or still checked out, it is kept and the reason is in `branchKept`. `dispatch.retire(handle, {cwd})` does the same cleanup without integrating, e.g. for dropped work, whose unmerged branch survives. Both take the receipt's handle or just its name (`ab lib dispatch retire <name>`), found under `<checkout>__worktrees/`. Cleanup is sequential, not transactional: if it fails after the merge, the merge remains. Inspect the worktree before repeating cleanup. Nothing is removed on merge failure.

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
