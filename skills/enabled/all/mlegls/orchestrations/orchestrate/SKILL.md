---
name: orchestrate
description: "Use to run a session-sized skill (e.g. `simplify`, `verify-story`, `garden`) over a scope too big for one session, when the units are not tracker children."
argument-hint: "the inner skill and its scope: a story tree, or a partitioned simplify or garden scope"
---

A ticketed issue subtree goes to `supervise` instead. Carry the agreed scope through to completion; bring back choices that change it.

1. find embarrassingly parallelizable session-sized units of work.
2. use `route.prepare` for each fresh assignment, supplying its recorded stance if any; launch ready assignments through `dispatch.dispatch`. Consequentially open contracts go to `shape`. Prompt by auftragstaktik, specifying desiderata only to the extent necessary for coordination without churn.
3. join serially as reports arrive (`multi-agent`); at an exception or `checkpoint`, use `route.continuation`; consult separately or replace from a compacted/OM-backed handoff. Merge changes; send conflicts back to the worker to resolve on its branch. Clean up workers as chunks complete. Replan the next ready wave from what landed.
4. after joining, compare the result with the original destination. finish remaining work within the agreed scope; if blocked, name the exact unresolved claim and what resolves it.

workers and messaging: `multi-agent`.
