---
name: orchestrate
description: "Use to run a session-sized skill (e.g. `implement`, `verify-story`, `simplify`) over a bigger scope than is appropriate for a self-contained session."
argument-hint: "the inner skill and its scope: a spec with tickets, a story tree, or a partitioned simplify scope"
---

carry the agreed scope through to completion; bring back choices that change it.

1. find embarrassingly parallelizable session-sized units of work.
2. use `route.prepare` for each fresh assignment, supplying its recorded stance if any; launch ready assignments through `dispatch.dispatch`. Return triage to a separate decision session. Open units start with `realize`. Prompt by auftragstaktik, specifying desiderata only to the extent necessary for coordination without churn.
3. join serially as reports arrive (`multi-agent`); at an exception or `checkpoint`, use `route.continuation`; consult separately or replace from a compacted/OM-backed handoff. Merge changes; send conflicts back to the worker to resolve on its branch. Update tracked work and clean up workers as chunks complete. Replan the next ready wave from what landed.
4. after joining, compare the result with the original destination. finish remaining work within the agreed scope, then resolve the issue; if blocked, name the exact unresolved claim and what resolves it.

workers and the board: `multi-agent`.
