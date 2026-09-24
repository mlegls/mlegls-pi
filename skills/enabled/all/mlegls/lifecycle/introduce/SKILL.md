---
name: introduce
description: "Use when the user says something about the project should change: a request, idea, complaint or observation that isn't a steer on the task already underway."
argument-hint: "the change"
---

Start from the user it serves. Find the story (`project-docs`) where the change would matter, or the realistic situation that would contain it, before judging the change: the request is evidence of a want, not yet the want. The story is what later verification checks against; without one, checks restate the implementation, and "is this really useful to its user" is the anchor against just doing what was said.

1. Premise: in that story, is the change needed, and is its framing right? Is it already solved in the project, its dependencies or the platform, or would a smaller change serve the same want? Say so before going on.
2. Records: find the issues, stories, frictions and research already tracking it (`tracker`), and extend them rather than duplicate.
3. Route: update the story with the intended outcome, keeping the request verbatim as its source, even when the change is session-sized. Then, if it's settled and session-sized, implement it here; the user saying it is the choice to do it directly. Otherwise record an issue at its honest stage, linked to the story, and stop. Work already under a supervisor goes to that supervisor.
