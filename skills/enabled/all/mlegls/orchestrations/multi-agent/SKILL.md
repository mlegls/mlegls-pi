---
name: multi-agent
description: "Use when dispatching or coordinating other agents: workers in worktrees, peers in other sessions, or both."
---

Prepared waves: `dispatch.dispatch` ([contract](../../../../../../docs/dispatch.md)). Parent owns decomposition, dependencies and concurrency; retain receipts; show long waits and they arrive by handle.

Under Paseo (`PASEO_AGENT_ID`, or `PI_EXECUTION_HOST=paseo` from any pi): use native agents, workspaces and messaging. Supervise with `paseo.withClient(c => c.agents.ref(ID).waitForFinish())`, `.timeline.refetch()`, and `.send(message)`. Workers report by ending their turn: the last message starts with `done`, `blocked`, or `needs-input`. For a question, end with `needs-input`; the answer arrives as the next message. Use the shared handoff schema in `agents/_common.md` when structured details help. Don't have workers send terminal reports to the parent mid-turn. Without exec, `paseo wait ID`, `paseo logs ID` and `paseo send ID` are the same operations; `ab lib dispatch dispatch` and `ab lib route prepare` take JSON arguments. A completed turn is not assignment completion. Integrate with plain Git, then archive. See [trial/setup](../../../../../../docs/paseo.md).

Standalone: `wm` workers return their report at turn end; use `board` for peer coordination, not terminal reports, and acknowledge handled peer messages.

`route.prepare` selects stance/model/effort for fresh assignments; `route.continuation` judges continue/consult/replace at exceptions. Size assignments to their context; consult old sessions for handoffs when replacing them. Integrate and retire settled workers with `merge`.

Join serially as reports arrive. At an exception or checkpoint, use `route.continuation`; consult separately or replace from a compacted/OM-backed handoff. Send merge conflicts back to the worker to resolve on its branch. Clean up workers as chunks complete, and replan the next wave from what landed. Prompt by auftragstaktik, specifying desiderata only as far as coordination needs.
