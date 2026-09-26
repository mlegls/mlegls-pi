---
name: multi-agent
description: "Use when dispatching or coordinating other agents: workers in worktrees, peers in other sessions, or both."
---

Prepared waves: `dispatch.dispatch` ([contract](../../../../../../docs/dispatch.md)). Parent owns decomposition, dependencies and concurrency; retain receipts; show long waits and they arrive by handle.

Workers are `wm` workers (workmux worktree + tmux window running pi). They report by ending their turn: the last message starts with `done`, `blocked`, or `needs-input`, posted on board topic `<run>/<handle>`; for a question, end with `needs-input` and the answer arrives as the next message. Subscribe to `<run>/*` (or wait with `children.turnEnd`) so reports wake you; `children.send` answers or steers. Use the shared handoff schema in `agents/_common.md` when structured details help. A completed turn is not assignment completion. Integrate with plain Git, then retire.

Use `board` for peer coordination, not terminal reports, and acknowledge handled peer messages.

`route.prepare` selects stance/model/effort for fresh assignments; `route.continuation` judges continue/consult/replace at exceptions. Size assignments to their context; consult old sessions for handoffs when replacing them. Integrate and retire settled workers with `merge`.

Join serially as reports arrive. At an exception or checkpoint, use `route.continuation`; consult separately or replace from a compacted/OM-backed handoff. Send merge conflicts back to the worker to resolve on its branch. Clean up workers as chunks complete, and replan the next wave from what landed. Prompt by auftragstaktik, specifying desiderata only as far as coordination needs.
