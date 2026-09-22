# Intent-driven computer use

The auto-loaded exec library `computer` drives native windows directly through
Cua. Code constructs bounded native actions from Cua elements; Jev selects an ID.
Native tokens and arguments stay in code. The parent supplies scope, intent,
completion condition, and exact text; Jev does not generate text or tool arguments.

```ts
state.drive = await computer.run({
  ui,
  apps: ["TextEdit"],
  windows: [{pid, window_id}], // optional exact subset of the allowed apps
  capture: {query: "Cua direct"}, // optional native query/max_elements/max_depth
  goal: "Replace the document body with the supplied replacement",
  until: "The document body is exactly Cua direct replacement works",
  inputs: {replacement: "Cua direct replacement works"},
  verify: async () => {
    const r = await ui.verify_state({pid, window_id,
      expect: [{element: {selector: {role: "AXTextArea"},
        value_equals: "Cua direct replacement works"}}],
      timeout_ms: 0, stable_samples: 1,
    });
    if (r.isError) throw new Error("Verification refused");
    return {source: "driver", result: r.structuredContent.status,
      evidence: r.structuredContent};
  },
  onEvent: e => console.log(e.status, e.selected?.description, e.completion),
});
show(state.drive);
```

[Setup and reviewed TextEdit encounter](guide/cua-background.md).
For long drives retain `notify(computer.run(...), "drive")` and poll in a later cell.
A reset interrupts the drive; do not blindly replay it. Credentials follow
`decide`: JEV_API_KEY or Cloudflare account/token environment variables. The
`decision` option accepts credentials, endpoint, and model overrides.

## Composition

`step(options, priorEvents)` performs one fresh observation/choice/action cycle;
`run(options)` repeats it, returning {status, trace}. `walk(steps, options)` runs
{label, expect, budget?} guide steps, carrying history forward. Keep prior events
when stepping manually. Separate windows are not separate writers: do not drive
the same window concurrently.

- `ui`, `apps`, `goal`, `until` are required. Apps match exact names, bundle IDs,
  or PIDs, ignoring case. Only running apps and on-screen windows are discovered;
  there is no frontmost fallback. `windows` restricts that scope further.
- `capture` passes Cua's native query and tree budgets unchanged. A query limits
  evidence as well as candidates; missing projected elements do not prove absence.
- Candidates are native click (AXPress), scroll, set_value for native text fields,
  and type_text insertion for web text fields. Eligibility is a conservative
  inference from native roles/actions, not a guarantee that delivery will succeed.
- `inputs` names exact strings. `resolveInput({goal,field,observation,signal})`
  optionally supplies parent-generated text; undefined stops with needs-input.
- `beforeAction({candidate,observation,signal})` returns allow, deny, or pause.
  It sees the resolved native {method,args}; default is allow within scope.
  Model probability is not authorization. The native runner uses background only.
- `screenshots: true` retains window images in the trace. Jev receives compact
  native semantic state, completeness, and candidate descriptions, not images,
  element tokens, or executable tool arguments.
- `onEvent` receives each completed cycle, including errors; hook failure rejects.
  Defaults: maxSteps 20, maxWaits 20, waitMs 500, timeoutMs 120000. A signal stops
  model calls, waits, and subsequent operations. In-flight UI calls obey the exec
  host lifecycle; cancellation cannot retract an already delivered action.

More than 512 candidates stops rather than silently dropping options. Repeated
action/unchanged-state pairs stop after two earlier occurrences. Native errors
stop without retry; unverifiable delivery is followed by fresh observation, not
treated as success. All raw Cua responses remain in the trace.

## Completion is evidence, not delivery

With `verify` supplied, only its satisfied result ends the run successfully.
It receives {goal, until, observations, signal} and returns {source: "driver" |
"application", result: "satisfied" | "unsatisfied" |
"unknown", evidence}. Unknown never becomes success through a model vote.
Verification runs on fresh observations. If it does not establish success, the
runner recaptures before generating actions: verify_state can replace native tokens.

Without a verifier, done requires both Jev's done choice and showing probability
at least 0.75. It is explicitly recorded as completion: judgment. There is no
wait-budget fallback to a contested success. Delivery receipts alone never finish
a task. AX verification proves only the stated predicates, not persistence.

Adaptive execution is not recorded regression. Keep accepted guide sequences,
checkpoint checks, and evidence; fresh goal-seeking may route around a broken step.

## Playwright surface

`computer.browser(page)` still works with run/step/walk. It uses its separate
Playwright controller and locator-backed replay format, not the Cua bridge.
`spec`, `sheet`, and `appeared` remain browser recording helpers. Its existing
two-judgment/contested-ending behavior is unchanged. Browser-specific types live
in lib/computer/browser-runner.ts; BrowserOptions and BrowserEvent are exported
from computer. Native UI has no compatibility aliases for the old outline/ref API.
