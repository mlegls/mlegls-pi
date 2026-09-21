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

When notified (or checking early), use `poll` in a later cell; it returns pending without waiting or destroying the kernel:

```ts
const check = await poll(state.preparing);
if (check.status === "ready") {
  state.prepared = check.value;
  await show.raw(state.prepared.text);
} else await show(check);
```

If pending, end the turn and wait for notification. If failed, inspect the error before retrying.
Use the carrying skill or stance and begin the returned assignment. For triage, begin with its questions; for idle, report the state.

`state.prepared.suggestion`, when present, is optional advice for the user, separate from the assignment. Continuing with the current model is fine. The full reading and decisions remain in `state.prepared.audit`.
