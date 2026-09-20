---
name: prototype
description: "Use when a design question needs a throwaway prototype of behavior, UI, or code structure."
---

A prototype answers a question more cheaply than committing to an answer.
Its fidelity follows the question:

- A state model someone needs to feel: [LOGIC.md](LOGIC.md), a shareable HTML
  demo with visible state and actions.
- A UI choice: [UI.md](UI.md), alternatives against the real surrounding app.
- An architectural shape: `theory-to-code` in prototype mode, with interfaces
  and dependencies generated from code.
- A property, performance question, or integration uncertainty: the smallest
  executable experiment that distinguishes the answers.

Confirm the question, fidelity, and scope before a substantial prototype
(`grilling`). A cheap probe can help choose the experiment.
Use `variety` when competing structures would reveal more than polishing one.
Keep the experiment isolated from production code and data: a scratch directory
or throwaway worktree, depending on what needs to be inherited. One command or
a double-click should run it.

The result is the answer and its evidence. Retain a branch, file, or artifact
when it is useful as a primary source, and link it from the question or spec.
Production inherits the validated decision; reusable code still has to meet
its production contract. Temporary tests and instrumentation are welcome when
they are the experiment, not a second product to maintain.
