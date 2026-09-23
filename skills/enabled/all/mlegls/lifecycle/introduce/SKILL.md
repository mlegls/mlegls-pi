---
name: introduce
description: "Use when asked to introduce an idea or request."
disable-model-invocation: true
argument-hint: "an idea, problem, or request"
---

Prepare this session with `introduce.run(intent)` in exec. Retain the promise:

```ts
state.preparing = introduce.run("the user's intent");
show.raw(state.preparing.then(prepared => (state.prepared = prepared).text));
```

The briefing arrives by handle when ready; if there is nothing else to do meanwhile, end the turn. If it failed, inspect the error before retrying.

Use the briefing to establish the idea with the user and record it (`tracker`), reusing related work. Return what is agreed, what remains open, and the suggested next entry. Continue into `shape` or `supervise` only when requested.

The full reading remains in `state.prepared.audit`.
