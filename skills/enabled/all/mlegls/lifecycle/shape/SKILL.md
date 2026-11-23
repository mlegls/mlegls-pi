---
name: shape
description: "Use to drive an idea or issue toward ready."
argument-hint: "an idea or issue, and its supervisor when there is one"
---

Carry this issue to `ready`: enough consensus on what to do that the rest happens autonomously. Ready names the motivating situation and desired outcome, settles the human choices, has an observable check, and waits on no unresolved human or external blocker (`tracker` lifecycle). How it splits into sessions is not part of readiness. Each step updates the body in place (`tracker`). Own exploratory workers and their results; stop at `ready` or at a specific external input that cannot be obtained here.

1. Story & destination: locate the motivating story (extend one where it fits; refactors cite the stories they preserve). Where destination, scope or human choices aren't settled, use `grill`; resolve discoverable facts through research or experiments. Record decisions and holes, each with how to resolve it; a hole is its own issue when it's a session or shared. Fill the holes worth filling first.
2. Shape & existing machinery: find which responsibilities existing code or dependencies can discharge before designing new ones. Resolve implementation choices within agreed promises autonomously; if a constraint threatens a promise, surface it at the program-theory level before asking to revise the promise. Sketch with `show-me` where useful. Stories hold intended outcomes; the issue holds implementation shape and open holes.
3. Prototype rendered UX: anything users will see is prototyped with me while shaping, in this session or a top-level sibling of the grilling thread (`artboard`), with approved screens linked from the issue (a drawing child leaves workers drawing just in time and queueing it for review). Rendered changes aren't ready until the prototype is approved.
4. Observable check: name what proves the outcome. Where the change touches a user surface that triggers `drive` (or declares `drive: always`), identify the starting state, surface, setup and any missing drive machinery—plan the experience, not an assertion inventory. Tests in an issue: see `testing`.
5. Split or mark `decompose: true`: split into independently executable children (with dependencies) when this session holds context that beats fresh decomposition later; otherwise mark multi-session work `decompose: true`. Cut each child as a tracer through its most different consumer (thin a consumer to de-scope it rather than moving it out). Research and technical-prototype children can be ready while the enclosing idea remains unsettled.

Update durable stories and issues (`project-docs`, `tracker`). A subtree goes to supervision whole: bring every child to `ready`, or move it out of the tree.

The tracker is the handoff: hold `claimed-by` while shaping and release it when ready so `pickup` (`supervise`) takes the tree without a readiness message. Tell the supervisor in `desk/ROLES.md` only a changed contract of a tree it is already running or a decision it must make (with none, `ab desk attention add`). If the tree isn't ready yet, return what remains.
