# Intent-driven computer use

Use `computer.run/step/walk` for goal-directed browser and desktop interaction.
Use direct tools for inspection, setup, deterministic replay, debugging, or
unsupported actions. When a browser CLI is needed, prefer `chrome-devtools-axi`.

## Browser CLI ownership and refs

`chrome-devtools-axi` already supports named sessions. Set
`CHROME_DEVTOOLS_AXI_SESSION` to a unique worker name (1–64 letters/digits/._-)
on **every invocation**, or export it within each shell call. Shell exports do
not survive the next bash tool call. The default session shares the selected
page and snapshot state with every other default-session caller; `newpage`
alone does not give a worker ownership of that selection.

With the default isolated launch mode, named sessions own separate bridges and
browsers. `AUTO_CONNECT`, `BROWSER_URL`, `USER_DATA_DIR` and shared MCP endpoints
can still point separate sessions at the same browser/profile. Naming is not a
page lock: use an exclusively assigned page or isolated project setup. Check
`pages` and the URL before judging a project story; stop only sessions you own.

Refs identify a snapshot, not stable locators. Use the latest snapshot or
snapshot returned by an action. `fill` followed by `click` with an older ref can
fail because filling changes the page. A DOM mutation can invalidate refs even
without another CLI command. On `STALE_REF`, inspect current state before
retrying: the preceding action may already have succeeded. For deterministic
replay, `chrome-devtools-axi run` supports CSS selectors without snapshot refs;
this does not solve shared-page ownership.

On 0.1.35, an isolated static-page probe retained usable refs across screenshot,
read-only eval and wait; plain-input fill replaced its value. Mutating another
DOM node invalidated the ref as designed. These results do not establish
controlled-input or highly dynamic application behavior. [Evidence](research/browser-cli-ownership-2026-09-26.md).

## From bash

```sh
ab computer --url http://127.0.0.1:4401/ncept/ \
  --input email=dev+clerk_test@example.com --input code=424242 \
  --until 'The signed-in learner home is visible' \
  'Sign in with the supplied existing account; do not create an account'
```

`--url` owns an isolated Chromium context, closes it afterward, and never borrows
an existing desktop window. Run from the package with Playwright 1.63+ installed;
it resolves the project's `@playwright/test`, then `playwright`. `--headed` shows
that browser. No second Playwright installation is added by ab.

For a project's existing authentication and lifecycle, supply `--browser ./setup.ts`.
The module default-exports an async function receiving `{signal}` and returning
`{page, close, verify?}`. For example, adapt an existing project helper:

```ts
import { prepare } from "./existing-browser-setup.ts";
export default async ({signal}) => {
  const session = await prepare({signal}); // owns an isolated or exclusively assigned page
  return {page: session.page, close: () => session.close(),
    verify: async () => {
      const visible = await session.page.getByRole("heading", {name: "Welcome Ada", exact: true}).isVisible();
      return {source: "application", result: visible ? "satisfied" : "unsatisfied", evidence: {visible}};
    },
  };
};
```

Setup owns cleanup if it fails before returning, and should honor `signal`.
The CLI calls `close` after success or failure; it does not close unrelated pages.
A browser trace cannot resume a closed context. To continue on a retained page,
let project setup reattach exclusively and start a new intent from fresh observation.

Native desktop use requires `--app NAME` resolving to one window, or explicit
`--window PID:WINDOW_ID`. There is no guessed-window fallback. Scope is not a lock:
assign one writer per target. `--resume DRIVE` is native-only and observes anew.

Every new CLI drive requires `--until`. Supply a journey and an observable end state,
not one parent-directed click at a time. Exact text comes from `--input name=VALUE`
or quoted spans in the intent; unquoted URLs in prose are not typing inputs.
Jev receives semantic state, not screenshots. Transient flashes, layout, native IME
behavior and claims that something *never* appeared need separate observation or
instrumentation; a final-state judgment cannot establish them.

For example, “the final turn sits above the composer” is a layout claim, not a
semantic `--until`. Reach the Session with the driver, then check overlap using
screenshots or browser geometry. For same-page evidence, use `--browser` setup
whose verifier or cleanup captures it before closing; a new `--url` invocation
starts a fresh context, not the page just driven.

## Native library surface

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
Long drives need no special handling: `show(computer.run(...))` yields and delivers the result by handle.
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

Large action sets use bounded nominations before the final choice: every candidate
is considered, and each request stays within Jev's 255-choice limit, including
four control choices. Nominations select actions, never establish completion. Repeated
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

Supply an existing Playwright page from the project's browser setup; the caller
owns its authentication, lifecycle, and cleanup. For example:

```ts
show(state.drive = computer.run({
  ui: computer.browser(page), apps: ["page"],
  goal: "Enter the supplied name and sign the guest book",
  until: "The page confirms that Ada signed the guest book",
  inputs: {name: "Ada"},
}));
// The outcome arrives by handle when the drive ends.
```

`computer.browser(page)` works with run/step/walk. It uses its separate
Playwright controller and locator-backed replay format, not the Cua bridge.
`spec`, `sheet`, and `appeared` remain browser recording helpers. Browser and native
runs share verifier precedence and require both judgments to agree without a verifier.
Browser-specific types live
in lib/computer/browser-runner.ts; BrowserOptions and BrowserEvent are exported
from computer. Native UI has no compatibility aliases for the old outline/ref API.

## Checked browser encounters — 2026-09-25

Live Jev and the project's Playwright 1.63 drove two isolated local fixtures:

- `--url`: entered Ada and signed a guest book in two actions, then stopped with
  `completion: judgment`. The captured heading was `Signed by Ada`.
- `--browser`: found Language among 301 enabled buttons, entered `zh-CN`, and saved
  in three actions. Completion came from the application verifier; an independent
  final read agreed on the saved value and `Saved language: zh-CN` heading.

An earlier guest-book pass delivered both actions but exhausted its waits: the
longer completion instructions yielded showing probabilities near 0.5 despite
visible success. The shorter current instructions passed the repeat. These are
smokes, not a reliability or token-savings estimate. Native background delivery
still has the limits in the [TextEdit encounter](guide/cua-background.md).

Regression coverage: `lib/computer/runner.test.ts` exercises 251/252/600 candidates,
tail selection with unchanged native tokens, verifier precedence, and disagreement
at the wait limit. `ab/computer.test.ts` checks CLI scope refusal and project-page
cleanup on completion and observation failure.
