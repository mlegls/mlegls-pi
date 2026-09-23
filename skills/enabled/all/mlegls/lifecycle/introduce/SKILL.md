---
name: introduce
description: "Use when asked to introduce an idea or request."
disable-model-invocation: true
argument-hint: "an idea, problem, or request"
---

Take the project views in exec and read over them yourself:

```ts
state.views = views.snapshot();
show.raw(views.format(state.views));
```

The views are computed and current as of their timestamp; narrate over them instead of recomputing or restating them. Read what they cannot tell: issue bodies and stories related to the intent, and what landed in git since the tracker last moved. Stay within the project and explicitly relevant sources; packaged skills are conventions, not project evidence. Reading is read-only: no claims, edits or launches.

Establish the intent in the project: find related work, distinguish what is agreed from what is open, and identify what must be established to record it. Locate the motivating user story and preserve the originating request or observation; extend an existing story and issue where appropriate.

Establish the idea with the user and record it (`tracker`), reusing related work. Return what is agreed, what remains open, and the suggested next entry. Stop once the idea is established; continue into `shape` or `supervise` only when requested. After the reading, before recording, is a natural point to compact and switch model.
