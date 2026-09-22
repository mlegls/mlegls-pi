---
name: plan
description: "Use for implementation-level planning: turn an agreed goal into an executable spec."
argument-hint: "a bounded goal whose destination is agreed"
---

1. Locate the motivating story: the real situation, want and originating request or observation. Extend an existing story where it fits; refactors cite the stories they preserve.
2. Before settling implementation shape, find which responsibilities existing machinery can discharge. Use `grill` to settle the intended affordance sequence, consequential choices and shared interfaces. Sketch the program with `show-me` where useful. Stories hold intended outcomes; the spec holds implementation shape and unresolved holes.
3. Make first use possible: identify the starting state, user surface and setup needed to try the change. Include missing fixtures or drive machinery in the assignments. Plan the experience, not an assertion inventory.
4. Split into independently executable contracts where useful, with ownership, dependencies and delegated authority. Research and prototype children can be ready while the enclosing goal remains unsettled. Review prototypes through interactive feedback; retain useful artifacts as references after their results are incorporated.
5. Update the durable stories and issues (`project-docs`, `tracker`). The guide is written just before or during first use, alongside its recording; implementation assignments include that handoff. Return what remains before `compile`, `implement` or `supervise`.
