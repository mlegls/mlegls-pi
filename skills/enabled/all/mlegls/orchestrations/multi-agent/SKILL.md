---
name: multi-agent
description: "Use when dispatching or coordinating other agents: workers in worktrees, peers in other sessions, or both."
---

Prepared waves: `dispatch.dispatch` ([contract](../../../../../../docs/dispatch.md)). Parent owns decomposition, dependencies and concurrency; retain receipts; show long waits and they arrive by handle.

Inside Paseo (`PASEO_AGENT_ID`): use native agents, workspaces and messaging. Supervise with `paseo.withClient(c => c.agents.ref(ID).waitForFinish())`, `.timeline.refetch()`, and `.send(message)`. CLI wait/logs/send remain manual recovery tools. Final output begins `done`, `blocked`, or `needs-input`; questions go to the parent ID. A completed turn is not assignment completion. Integrate with plain Git, then archive. See [trial/setup](../../../../../../docs/paseo.md).

Standalone: `wm` workers and `board` messages; acknowledge handled reports. Inside Orca only: load `orca skills get orchestration` and use its Run/Dispatch lifecycle ([API](../../../../../../docs/orca.md)).

`route.prepare` selects stance/model/effort for fresh assignments; `route.continuation` judges continue/consult/replace at exceptions. Size assignments to their context; consult old sessions for handoffs when replacing them. Integrate and retire settled workers with `merge`.
