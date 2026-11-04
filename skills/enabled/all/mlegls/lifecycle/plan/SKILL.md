---
name: plan
description: "Use for implementation-level planning: turn an agreed goal into an executable spec."
argument-hint: "a bounded goal whose destination is agreed"
---

1. Locate the motivating story: the real situation, want and originating request or observation. Extend an existing story where it fits; refactors cite the stories they preserve.
2. Before settling implementation shape, find which responsibilities existing machinery can discharge. Use `grill` where the maintainer contributes intent, theory or UX judgment. Resolve implementation choices within the agreed promises autonomously; decision difficulty is not a human dependency. If implementation constraints threaten a promise, explain why at the program-theory surface before asking which promise to revise. Sketch the program with `show-me` where useful. Stories hold intended outcomes; the spec holds implementation shape and unresolved holes.
3. Make first use possible: identify the starting state, user surface and setup needed to try the change. Include missing fixtures or drive machinery in the assignments. Plan the experience, not an assertion inventory. Tests in a ticket: see `testing`.
4. Split into independently executable children where useful, with their dependencies. Cut each as a tracer through its most different consumer; to de-scope a consumer, thin it rather than move it out, since an interface proven only on similar consumers hard-codes their similarity. Research and technical prototype children can be ready while the enclosing goal remains unsettled; review them through interactive feedback. Prototype anything users will see with me while planning, in this session or a top-level sibling of the grilling thread (`artboard`), and link the approved screens from the spec: a drawing child leaves workers drawing just in time and queueing it for my review. Retain useful artifacts as references after their results are incorporated.
5. Update the durable stories and issues (`project-docs`, `tracker`). The guide is written just before or during first use, alongside its recording; implementation assignments include that handoff. Return what remains before `implement` or `supervise`.
