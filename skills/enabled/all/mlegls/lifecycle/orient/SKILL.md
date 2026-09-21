---
name: orient
description: "Use when arriving at a project or asking where things stand and what to do next."
argument-hint: "an issue subtree, or nothing for the project"
---

Prepare orientation with exec; supply the requested scope when given:

```ts
state.preparing = orient.run();
notify(state.preparing.then(() => "Orientation is ready"), "orient");
```

When notified, poll in a later cell. If pending, end the turn and wait; if failed, inspect before retrying.

```ts
const check = await poll(state.preparing);
if (check.status === "ready") {
  state.prepared = check.value;
  await show.raw(state.prepared.text);
} else await show(check);
```

Explain where things stand and recommend the next entry: resume or start a supervisor, shape an issue, or introduce intent. Rank what needs the user by what it unblocks. The recommendation is not authorization to execute it. Full reading remains in state.prepared.audit; the views it rests on in state.prepared.views. Before acting on the briefing later in the session, `await show.raw(state.prepared.recheck())`.
