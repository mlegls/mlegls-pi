---
name: introduce
description: "Use when asked to introduce an idea or request."
disable-model-invocation: true
argument-hint: "an idea, problem, or request"
---

Prepare this session with `introduce.run(intent)` in exec. Retain the promise:

```ts
state.preparing = introduce.run("the user's intent");
notify(state.preparing.then(() => "Session preparation is ready"), "introduce");
```

When notified, in a later cell, `state.prepared = await state.preparing; await show.raw(state.prepared.text);`.
Use the carrying skill or stance and begin the returned assignment. For triage, begin with its questions; for idle, report the state.

`state.prepared.suggestion`, when present, is optional advice for the user, separate from the assignment. Continuing with the current model is fine. The full reading and decisions remain in `state.prepared.audit`.
