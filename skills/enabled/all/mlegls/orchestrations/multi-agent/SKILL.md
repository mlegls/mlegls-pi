---
name: multi-agent
description: "Use when dispatching or coordinating other agents: workers in worktrees, peers in other sessions, or both."
---

Prepared waves: `tools.dispatch` ([contract](../../../../../../docs/dispatch.md)). Parent owns decomposition, dependencies and concurrency; retain receipts.

Workers are `wm` workers (bb threads: a worktree and a pi run by bb). They report by ending their turn: the last message starts with `done`, `blocked`, `needs-input` or `checkpoint`; for a question, end with `needs-input` and the answer arrives as the next message. Workers are your child bb threads, so bb tells you when each finishes; `bb thread tell <thread> --mode queue` answers or steers. Use the shared handoff schema in `agents/_common.md` when structured details help. A completed turn is not assignment completion. `/jump <handle>` opens a worker's session.

Peers coordinate through the tracker and `desk/` (`ROLES.md` names who holds a role); to ask one a question, `bb thread tell <thread> --mode queue` and don't wait on the answer.

Choose each fresh assignment's stance from `~/dev/mlegls-pi/routing.md`; `models.classify` can judge it when the call is close. Size assignments to their context. Integrate and retire settled workers with `merge`.

Join serially as reports arrive. At an exception or checkpoint, decide whether the worker continues, gets a consultation, or is replaced from a handoff. Send merge conflicts back to the worker to resolve on its branch. Clean up workers as chunks complete, and replan the next wave from what landed. Prompt by auftragstaktik, specifying desiderata only as far as coordination needs.
