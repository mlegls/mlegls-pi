# Dispatch a ready wave

The supervisor follows the issue graph and coordinates ready streams; complex triage returns to a separate decision session. `realize` carries that workflow: autoread → recorded plan → assignment admission → dispatch → integration. Dispatch itself only launches prepared assignments. Work shape, model/effort, capability tradeoffs, and session-continuity policy live in `routing.md`.

`lib/dispatch.ts` selects BB when `BB_THREAD_ID` is set, otherwise workmux. In exec (after `/exec-reset`):

```ts
const task = "Implement the agreed change. Context: … Interfaces/ownership: … Done: …";
const execution = await route.prepare(task); // pass { stance: "fill" } for a recorded closed unit
if (execution.kind === "triage") throw new Error("Prepare a decision-session handoff before launching");
state.launch = notify(dispatch.dispatch([
  { handle: "unit-a", prompt: task, ...execution },
], { run: "feature-x" }), "dispatch"); // BB
```

In a later cell: `state.wave = await state.launch; await show(state.wave);`

Outside BB, options must include `{ run, maxConcurrent: 3, active: [] }`. For later waves, supply **all outstanding workmux handles** supervised by this parent in `active`. Retire them from that list after integrating/closing them. Dispatch admits at most `maxConcurrent - active.length` assignments; excess stays `pending`. Serialize submissions from one parent. This is a parent-scoped budget, not a host-wide lock against other parents or direct workmux calls. The installed workmux `--max-concurrent` counts only windows from a single invocation, so it cannot enforce separately prompted waves.

BB uses its configured global/host limits, including its native queue; dispatch never changes those settings. Omit `maxConcurrent` and `active` there. Model IDs and reasoning levels must be valid for BB's Pi provider. Each BB worker is a child thread in a fresh worktree on its parent's host/project.

## Assignments and receipts

Each assignment has `handle`, self-contained `prompt`, `model` (provider/model), `effort`, optional `agent` (roster stance), and optional `base` (exact Git ref). Agent bodies are included on both backends; their legacy `runCommand` does not select execution. Workmux launches Pi with exec/ls and the supplied model/effort. BB receives the same selection through its provider flags. Set `base` explicitly when the worker must start at a particular commit; omission uses the backend's default, not uncommitted parent changes.

Returns:

- `launched`: BB `{ backend, handle, id, environmentId, status }`, or workmux `{ backend, handle, worker }` retaining the native Worker object.
- `failed`: the first attempted assignment that failed and its error. Earlier launches remain alive. A backend failure or interrupted call can leave resources behind; inspect before retrying.
- `pending`: assignments never attempted, because capacity ran out or an earlier launch failed. The parent decides when to submit them.

Invalid assignments fail before launch. There are no implicit retries, model decisions, dependency scheduling, merges, or cleanup. Keep the launch promise across exec cells; don't interrupt a mutation just because a cell deadline is short.

## Supervision

BB wakes the parent when a child idles. Use `bb thread wait/output/tell/show` with the returned ID; inspect and merge its changes, then archive it.

Workmux returns native library Workers: `worker.next()`, `worker.send(text)`, `worker.close()`, and `merge(worker)` from `lib/wm.ts`. Use `notify(worker.next(), label)` in exec for a report notification. These are library workers, not the exec host's `wm` handle registry; dispatch does not install board wake subscriptions. Await/notify their events, or explicitly subscribe through `board`.

The old experimental classifier in `lib/classify.ts` remains for its calibration consumers. Runtime admission is `route.prepare`: recorded stance first, otherwise policy-owned Jev classification, then model/effort selection. Neither classifier discovers context or creates a decomposition. Dispatch does not implicitly classify or reroute.

## Session boundaries

Use `route.continuation({ current: { model, effort }, assignment, report, remaining, context, handoff }, options)` at an exception or context checkpoint. Include measured cache use or known handoff size in that evidence when available; missing facts stay unknown.

- `continue`: retain the current session/model and relevant context.
- `consult`: prepare a bounded question and evidence packet; `route.prepare` it (recorded `session-triage` for decisions outside delegated authority), launch a separate session, then return its decision to the warm worker.
- `replace`: preserve commits and outstanding work, update the issue, and prepare a compacted/OM-backed handoff. Admit and launch a new session from the intended base; stop the old worker before transferring write ownership. Retire it after the handoff is secured.

A `prepare` result with `kind: "triage"` supplies the selected model/effort but no agent. Launch a new session with the explicit decision question, evidence, and requirement to update the issues; do not dispatch the original implementation prompt. Re-admit execution after the decision.

These tools do not transfer memory, compact history, change models in place, manage dependencies, or terminate workers. Save their returned judgments with the assignment/report when evaluating cost to accepted completion, including repair and escalation.
