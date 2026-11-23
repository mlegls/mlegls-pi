---
name: introduce
description: "Use when the user says something about the project should change: a request, idea, complaint or observation that isn't a steer on the task already underway."
argument-hint: "the change"
---

Start from the user it serves. Find the story (`project-docs`) where the change would matter, or the realistic situation that would contain it, before judging the change: the request is evidence of a want, not yet the want. The story is what later verification checks against; without one, checks restate the implementation, and "is this really useful to its user" is the anchor against just doing what was said.

1. Premise: in that story, is the change needed, and is its framing right? Is it already solved in the project, its dependencies or the platform, or would a smaller change serve the same want? Say so before going on.
2. Records: find the issues, stories, frictions and research already tracking it (`tracker`), and extend them rather than duplicate. That includes in-flight ready issues in its area (claims): a concern that bears on running work goes to its supervisor as an amendment now, not after it lands.

   > No: "test runs take too long" → speed up `bun test`, while a running issue refolds the browser suite unaware.
   > Yes: same, plus mail that issue's supervisor "wall time is a goal of the refold".
3. Route:
   - Settled and session-sized: update the linked story if one applies, then implement it here (the user saying it is the choice to do it directly) or file `stage: ready` for `pickup`.
   - Still rough or undecided: capture cheaply as `stage: idea` with the request/situation verbatim, without forcing story surgery yet (`assignee: human` if a decision is needed, `agent` if research or shaping can advance it). With the user present, end on the questions it waits on. Work already under a supervisor goes to that supervisor.
