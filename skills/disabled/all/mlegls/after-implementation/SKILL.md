---
name: after-implementation
description: "Always use after a code change, before committing, submitting, or opening a PR."
---

Gemba. The edited code, the passing checks, and the thing the user experiences
are different observations. Completion brings them together.

1. Run the project's relevant checks; interpret lints through `evaluate-lints`.
2. Read the diff and `git diff --stat`. What became simpler, and where did the
   complexity go? Fewer lines are useful evidence, not the definition.
3. Run the changed path and inspect its resulting value or artifact. For
   delegated work, inspect the actual diff as well as the report.
4. Propose friction worth revisiting as `difficult` (`architecture`); confirm
   the tracker change before recording it (`grilling`). A patch that was harder
   than its behavior warrants is a useful specimen.
5. Commit coherent, verified changes according to the project's workflow.
