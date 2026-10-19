---
stage: "ticket"
assignee: "agent"
author: "session:01a15212-f5c4-72f9-98e1-e4e2ab51097c"
part-of: "[[projects/mlegls-pi/issues/replace-the-board-with-bb-mail]]"
---
A bb plugin drops bb's child-completion notices about reconciler workers, so the supervisor wakes only for exceptions and a run's completion.

Every child notice passes through the `message.dispatch` hook (`bb.experimental_hooks.on`, Plugin SDK 0.6.54): in `bb.db` they're `turn/start` tells with `initiator: "system"`, `systemMessageKind: "child-completed"`, text `[bb system]\n\n@thread:<child> completed:`. The hook context doesn't expose `systemMessageKind`, so match `ctx.initiator === "system"` plus the text.

Done:
- A notice about a reconciler-owned worker is rejected; every other message proceeds, including the reconciler's own tells to its owner and notices about children the supervisor spawned itself. How the plugin recognises reconciler workers (title `<issue>/<issue>-<phase>-<n>`, plugin metadata set at spawn, or the reconciler's state) is the implementer's choice.
- Checked live: what core does with a rejected system tell (no error surfaced to the maintainer, the child still shows its status in the tree), and the supervisor gets no turn for a worker's completion.
- Workers stay children of the supervisor.
