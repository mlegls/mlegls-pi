---
name: realize
description: "Use to carry specified work through to done, organizing its concurrent streams."
argument-hint: "a ticket or agreed scope"
---

1. `autoread.run` the scope and relevant context. Supervise from the dependencies, ownership, interfaces, and acceptance recorded in the issues.
2. Arrange ready streams Gantt-style. Keep small known changes here when warm context beats a handoff. Closed parallel units → `compile`; open units → `orchestrate`; mixed waves are normal.
3. `route.prepare(taskWithContext, { stance })` each fresh assignment; omit stance unless already recorded. A triage result goes to a new decision session with the unresolved question and evidence; resume from its updated issues.
4. `dispatch.dispatch` the ready wave with its context and coordination constraints. [Launch contract](../../../../../../docs/dispatch.md). Bind an Orca Run first; pass its ID, outstanding handles, and budget.
5. Integrate reports and changes, update the issues, and launch the next ready wave. At an exception or context checkpoint, `route.continuation` with current execution, report, remaining work, and context/handoff evidence. Consult through a separate session; replace from an updated ticket and compacted/OM-backed handoff, preserving work before retiring the old session. Finish against the original destination.

A refactor is expand–contract: compile the replacement against surviving interfaces and old tests, then prune the contract.
