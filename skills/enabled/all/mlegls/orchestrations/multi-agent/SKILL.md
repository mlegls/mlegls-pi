---
name: multi-agent
description: "Use when dispatching or coordinating other agents: workers in worktrees, peers in other sessions, or both."
---

Prepared waves: `tools.dispatch` ([contract](../../../../../../docs/dispatch.md)). Parent owns decomposition, dependencies and concurrency; retain receipts.

Workers are `wm` workers (workmux worktree + tmux window running pi). They report by ending their turn: the last message starts with `done`, `blocked`, `needs-input` or `checkpoint`, posted on board topic `<run>/<handle>`; for a question, end with `needs-input` and the answer arrives as the next message. Dispatch subscribes you to `<run>/**` with wake, so reports start your next turn; `tools.mail({to: "<run>/<handle>", body})` answers or steers. Use the shared handoff schema in `agents/_common.md` when structured details help. A completed turn is not assignment completion. `/jump <handle>` opens a worker's session.

Use the board for peer coordination, not terminal reports, and `tools.board_ack` handled peer messages. Read `tools.board_read({topic: "<run>/**"})` without a report tag filter before touching shared seams: it includes base-topic decisions and all descendants (including nested runs), whereas `<run>/*` misses the base topic.

Choose each fresh assignment's stance from `~/dev/mlegls-pi/routing.md`; `models.classify` can judge it when the call is close. Size assignments to their context. Integrate and retire settled workers with `merge`.

Join serially as reports arrive. At an exception or checkpoint, decide whether the worker continues, gets a consultation, or is replaced from a handoff. Send merge conflicts back to the worker to resolve on its branch. Clean up workers as chunks complete, and replan the next wave from what landed. Prompt by auftragstaktik, specifying desiderata only as far as coordination needs.
