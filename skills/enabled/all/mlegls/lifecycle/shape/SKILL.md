---
name: shape
description: "Use to drive an idea or issue toward agent-ready specs or tickets."
argument-hint: "an idea or issue, and its supervisor when there is one"
---

Carry this issue to agent-ready specs or tickets, each stage adding to its body (`tracker`). Use `map` for the destination and `plan` for its realization; grill consequential choices and resolve discoverable facts through research or experiments. Own exploratory workers and interpretation of their results. Stop there or at a specific external input that cannot be obtained here.

A subtree goes to supervision whole: refine every child to spec/ticket, or move it out of the tree, before handing it over.

Record the goal, shape, decisions, remaining holes and dependencies in the tracker. The tracker is the handoff: don't message a supervisor that work is ready; a project's pickup (`supervise`) takes newly ready trees in its scope. Hold `claimed-by` on the tree while you shape it and release it when the tree is ready, so it isn't taken half-written. Tell the supervisor named in `desk/ROLES.md` only what needs it: a changed contract of a tree it is already running, or a decision it must make; with none, add it through `ab desk attention add TITLE --file PATH`. Use `ab desk` for all writes to `desk/ATTENTION.md` and `desk/ROLES.md` (`ab desk --help`); each write cleans both of archived/deleted owners.
