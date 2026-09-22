# Background native UI through exec

for: a Pi user working in another app while an agent operates a native window

## Setup and direct use

Install the root optional dependencies and restart Pi. /computer-use reports
permissions; /computer-use setup requests them for the host process. Grants to
the old pi-computer-use helper are not inherited. /exec-reset alone does not load
a changed extension-host backend.

```ts
const apps = (await ui.list_apps({})).structuredContent.apps;
const app = apps.find(a => a.name === "TextEdit" && a.running);
const windows = (await ui.list_windows({pid: app.pid, on_screen_only: true})).structuredContent.windows;
// Choose the intended window explicitly; do not assume array order or title uniqueness.
const target = {pid: app.pid, window_id: chosenWindow.window_id};
const view = await ui.get_window_state({...target, include_screenshot: true});
await show(view);
const field = view.structuredContent.elements.find(e => e.role === "AXTextArea");
await show(await ui.set_value({...target, element_token: field.element_token,
  value: "Cua direct replacement works"}));
const verified = await ui.verify_state({...target,
  expect: [{element: {selector: {role: "AXTextArea"},
    value_equals: "Cua direct replacement works"}}],
  timeout_ms: 0, stable_samples: 1,
});
await show(verified);
```

This is Cua's native tool protocol, including snake_case names and structuredContent.
Read ui.help(method) for the installed schema and exec policy. The UI layer does
not build another tree or allocate another set of element IDs. Search captured
elements in JS, or use Cua's native query on a fresh get_window_state call.

Observe before each write. Native tokens are consumed by a write or verification;
a failed/cancelled operation may already have landed. No automatic retry or
foreground escalation. delivery_mode: foreground is explicit opt-in on supported
writes; the Jev runner uses background only. Reloading or changing session/branch
discards the native session; historical observations are never restored as actions.

## Reviewed direct-runner encounter — 2026-09-22, Cua 0.28.2

A fresh unsaved TextEdit document contained “Cua direct probe” (the recorded final
pass used Untitled 3). It was
selected by its exact PID/window ID and checked against that text before mutation.
A screenshot showed the inactive document and probe text. Zed was frontmost
during the first two passes, Orca during the final pass.
The native runtime and public computer.run performed this sequence:

1. Discovered running TextEdit and its window. get_window_state returned native
   snapshot_id, element_token, roles, actions, tree_markdown, and background_input
   metadata. No translation into old refs or an outline was involved.
2. verify_state checked the AXTextArea's exact value and did not report success.
   The runner recaptured before making action candidates because verification
   replaces Cua's native observation context.
3. Live Jev selected a2, “Replace AXTextArea Cua direct probe [element 1] with input replacement”.
   Showing probability was 0.05. Code copied the supplied string unchanged into
   the native set_value arguments and retained the exact current element_token.
4. On the next cycle, verify_state reported status satisfied, stable true,
   samples 1. The run ended after two events, completion: driver. No second Jev
   call or model done vote was used. This checks AX value, not saved persistence.
5. Reusing the consumed token failed before dispatch. Resetting the runtime and
   attempting the same write also failed before dispatch.

The unfiltered first pass exposed app menus as well as the document: Jev input
was 29,208 tokens. Repeating with capture: {query: "Cua direct"} retained the native
window/text-area ancestor projection and used 982 input tokens. The final pass
added native element indices to candidate descriptions to disambiguate repeated
labels, used 997 input tokens, and produced the checked-in recording. The query remained
valid after replacement. The native response honestly reported elements_complete:
false. Querying is deliberate evidence reduction, not proof of absence.

Each pass sampled the same frontmost app before and after (Zed, then Orca).
The first pass sampled an
unchanged cursor. During the subsequent passes, cursor endpoints differed while the person
was using the desktop; those samples cannot attribute movement or exclude transient
focus changes. No stronger isolation claim is made.

The probe document was discarded after verification. Replay:
[extensions/exec/cua-runtime.test.ts](../../extensions/exec/cua-runtime.test.ts),
using the [native/JeV recording](../../extensions/exec/fixtures/cua-direct-textedit.json).
App inventory is projected to TextEdit; window snapshots and the model response
are retained from the query-bounded encounter. Historical tokens terminate at a
fake native boundary; model calls replay through a local HTTP endpoint.

The existing Kernel RPC replay was migrated to the same native observation:
ordered images, structuredContent/token access, visible errors, interruption,
late backend completion, and session reset without state restoration. It lives
in extensions/exec/migration.test.ts.

Not yet demonstrated: Electron/custom controls, live background scrolling/keys,
foreground opt-in, continuous focus isolation, cross-platform delivery, or live
interruption of an in-flight mutation. The API deliberately exposes native Cua
rather than claiming those surfaces work. The earlier TextEdit backend trial also
delivered a bold-button press, but Cua reported its effect unverifiable.

For Jev composition, verifier precedence, action gates, and the separate Playwright
recording surface, see [computer](../computer.md).
