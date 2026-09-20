---
name: advance
description: "Use to advance recorded work in one issue's subtree or the whole tracker."
disable-model-invocation: true
argument-hint: "an issue slug, or nothing for the whole tracker"
---

Prepare this session with `advance.run(scope)` in exec; omit scope for the current project tracker. Retain the promise:

```ts
state.preparing = advance.run();
notify(state.preparing.then(() => "Session preparation is ready"), "advance");
```

When notified, in a later cell, `state.prepared = await state.preparing; await show.raw(state.prepared.text);`.
Use the carrying skill or stance and begin the returned assignment. For triage, begin with its questions; for idle, report the state.

`state.prepared.suggestion`, when present, is optional advice for the user, separate from the assignment. Continuing with the current model is fine. The full reading and decisions remain in `state.prepared.audit`.
