---
name: realize
description: "Use to carry specified work through to done, organizing its concurrent streams."
argument-hint: "a ticket or agreed scope"
---

1. `autoread.run` the scope, its stories and theory, and relevant code. Use the briefing to begin useful work.
2. Plan the streams Gantt-style: dependencies, shared interfaces and ownership, what stays here, and what can run concurrently. Keep this judgment in the parent. Unclear done → `plan`; a bounded change → `implement`; closed parallel units → `compile`; open units → `orchestrate`.
3. Choose each delegated stream's stance from `multi-agent`, then `route.route(stance, taskWithContext)` for model/effort. Keep work here when warm context is worth more than a handoff.
4. `dispatch.dispatch` the ready wave with its context and coordination constraints. [Launch contract](../../../../../../docs/dispatch.md). Pass the outstanding handles and budget on workmux; BB enforces its native limits.
5. Integrate reports and changes, revise the remaining streams, and launch the next ready wave. At checkpoints, continue or respawn from the updated ticket. Finish against the original destination.

A refactor is expand–contract: compile the replacement against surviving interfaces and old tests, then prune the contract.
