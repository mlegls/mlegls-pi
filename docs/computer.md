# Intent-driven computer use

The auto-loaded exec library `computer` chooses bounded AX actions with Jev and executes them through the existing `ui` bridge. The parent supplies app scope, intent, completion condition, and text. Jev does not generate text.

```ts
state.drive = await computer.run({
  ui,
  apps: ["Calculator"],
  goal: "Calculate 7 times 8",
  until: "The calculator display shows 56",
  onEvent: event => console.log(event.status, event.selected?.description),
});
show(state.drive);
```

For long drives use `state.drive = notify(computer.run(...), "drive")`, then `poll(state.drive)` in a later cell rather than awaiting across exec’s cell deadline. A kernel reset interrupts the drive; do not blindly replay it. Credentials follow `decide`: `JEV_API_KEY`, or Cloudflare account/token environment variables. `decision` accepts explicit credentials, endpoint, and model overrides.

## Composition

`computer.step(options, priorEvents)` performs one fresh observation/decision/action cycle. `computer.run(options)` repeats it, returning `{status, trace}`. Keep prior events when manually stepping for history and loop detection. Do not drive the same desktop concurrently.

- `ui`, `apps`, `goal`, `until` are required. App names match discovery exactly, ignoring case. Apps must already be running; no frontmost-app fallback.
- `inputs` maps names to exact strings. Jev selects a field/input pair; code copies the string unchanged. Replacement requires AX `canSetValue`.
- `resolveInput({goal, field, observation, signal})` optionally supplies text, including through a parent LLM call. Undefined stops with `needs-input`. No implicit provider is installed.
- `beforeAction({candidate, observation, signal})` returns `allow`, `deny`, or `pause`. It sees resolved text. Default is allow within scope; use a gate for consequential actions. Model probability is not authorization.
- `onEvent(event)` receives each completed cycle, including terminal failures. Retain/write these for evidence. Hook failure rejects rather than retrying.
- `screenshots: true` requests visual observations. Images remain in the trace; Jev sees AX state, not pixels. Default is semantic.
- `maxSteps` defaults to 20; `timeoutMs` to 120000. `signal` cancels model calls/waits and prevents subsequent operations. In-flight UI calls obey the exec host lifecycle; cancellation cannot retract a delivered action.

Candidates are presses, exact replacements, and vertical scrolling on nodes advertising those capabilities. Wait, done, stuck, and needs-input are always available. Unsupported/hidden controls need parent intervention: this is not a coordinate agent or long-range planner. Discovery is bounded by the UI bridge; raw receipts retain completeness information. More than 512 candidates stops rather than silently removing options.

Events retain discovery/observation receipts, candidates, selection and distribution, actual outcome, timestamp, and terminal reason. Actions use the observation state ID for bridge freshness checks. Errors and ambiguous outcomes stop without retry; effects may already have landed. Repeated action/unchanged-state pairs stop after two earlier occurrences.

## Story verification

`done` is the driver’s judgment, **not** an assertion result. Compose drives with independent checks at guide joins; preserve checks and evidence alongside traces. Screenshots capture appearance; AX values capture semantic state. Neither proves unobserved persistence.

Adaptive execution is not recorded regression. Do not silently replace an accepted guide sequence with fresh goal-seeking behavior: it might route around a broken step. The parent owns recorded sequences, checkpoint acceptance, and story arguments. This library provides execution and evidence only.
