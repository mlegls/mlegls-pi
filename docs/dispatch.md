# Dispatch a ready wave

The parent plans concurrent streams and revises their dependencies as results arrive. `realize` carries that workflow: autoread → parent planning → model routing → dispatch → integration. Dispatch itself only launches prepared assignments.

`lib/dispatch.ts` selects BB when `BB_THREAD_ID` is set, otherwise workmux. In exec (after `/exec-reset`):

```ts
const task = "Implement the agreed change. Context: … Interfaces/ownership: … Done: …";
const execution = await route.route("auto-routine", task);
state.launch = notify(dispatch.dispatch([
  { handle: "unit-a", prompt: task, agent: "auto-routine", ...execution },
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

The old experimental Jev work-shape classifier is preserved in `lib/classify.ts` (`classify`); it is not called by dispatch. Its calibration remains separate from parent-owned planning.
