---
name: multi-agent
description: "Use when dispatching or coordinating other agents: workers in worktrees, peers in other sessions, or both."
---

Orca owns execution and coordination in every client. Load its version-matched orchestration guide: `orca skills get orchestration`.

Prepared waves: `dispatch.dispatch` ([contract](../../../../../../docs/dispatch.md)). Direct supervision: exec’s `orca` library ([API and lifecycle](../../../../../../docs/orca.md)). Bind a Run; preserve Task/Dispatch identities and authoritative worker preambles. Process each inbox delivery, decide settled workers’ ownership, then acknowledge. Retain long waits with `notify`.

Mesh: send to a known `dispatch:<id>` or `run:<id>`; groups are scoped by Orca. Ordinary conversation handoffs and `/fork-tab` need no task records.

`route.prepare` selects stance/model/effort for fresh assignments; `route.continuation` judges continue/consult/replace at exceptions. Size assignments to their context; consult old sessions for handoffs when replacing them. Integrate and retire settled workers with `merge`.
