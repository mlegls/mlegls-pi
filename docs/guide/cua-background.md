# Background native UI through exec

for: a Pi user working in another app while an agent operates a native window

## Setup and use

Install the root optional dependencies and restart Pi to load the Cua backend.
Run /computer-use for permission status; /computer-use setup requests permissions
for the host process. The old pi-computer-use helper's grants are not inherited.

Discover an already-running app with ui.findRoots({app: "TextEdit"}). Select the
intended window from details.windows, then call ui.observe({root: windowRef,
mode: "visual"}). show(view) emits AX text with usable refs and the window image.
ui.search({stateId: view.capture.stateId, role: "TextArea"}) searches that snapshot.

Use one action per observation:

```ts
await show(await ui.act({
  stateId: view.capture.stateId,
  actions: [{action: "setText", ref: fieldRef, text: "Cua background replacement works"}],
}));
```

Observe the same window again to verify the effect and obtain new refs. setText
replaces a native AX text value; typeText inserts text. A press uses a native
snapshot token. Neither implicitly permits foreground delivery. Read ui.help("act")
before choosing other operations. A failed/cancelled action may already have
landed; do not replay without inspecting new state.

Restarting, changing session/branch, or reloading discards native refs. Rediscover
and observe. Cached search/inspection is historical evidence, not a live check.
Two agents must not write the same window concurrently.

## Reviewed encounter — 2026-09-22, Cua 0.28.2

The maintainer created an unsaved TextEdit document containing “Cua background
probe”, without activating it. Orca was frontmost during the measured sequence.
Through createCuaRuntime, the same runtime used by exec:

1. Discovered TextEdit and selected its uniquely titled Untitled window. Initial
   discovery also exposed a blank off-screen utility window; discovery now asks
   Cua for on-screen windows rather than attempting to operate that utility surface.
2. Captured AX plus a screenshot. Reviewed the image: the inactive TextEdit window
   contained the probe text. Corrected the image adapter to read dataBase64, not data.
3. Replaced the text. Cua reported background/accessibility delivery, effect
   confirmed, evidence value_readback. Re-observation showed exactly “Cua background
   replacement works”. Native controls omit inWebContent rather than returning false;
   capability projection now accounts for that convention.
4. Inspecting the consumed observation failed with “Stale or unavailable UI state”.
5. Pressed the bold button. Cua reported background/accessibility, effect unverifiable;
   this is recorded as delivery only, not a verified formatting change. Numeric SDK
   enums are translated to readable names in the agent's receipt.
6. Before/after samples both reported Orca frontmost and cursor (413, 367). These
   endpoints do not establish that no transient focus/cursor movement occurred.
7. Reset the runtime. The prior root was rejected with “Unknown window ref”.

The probe document was discarded after verification. The replay is
[extensions/exec/cua-runtime.test.ts](../../extensions/exec/cua-runtime.test.ts),
using a [native response projection](../../extensions/exec/fixtures/cua-textedit-0.28.2.json)
recorded from this sequence. Historical tokens terminate at a fake driver in the
replay. Existing exec migration tests cover bridge/display/lifecycle transport.

Not yet demonstrated: Electron/custom controls, background scrolling/keys,
foreground opt-in, continuous focus isolation, cross-platform delivery, or live
interruption of an in-flight mutation. The native typed SDK omits some platform
extensions; set_value, type_text, press_key, and scroll use Cua's generic tool seam.
This is a backend trial, not a universal background-compatibility claim.
