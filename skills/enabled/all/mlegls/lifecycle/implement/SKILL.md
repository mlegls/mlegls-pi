---
name: implement
description: "Use to make a bounded, agreed change."
argument-hint: "a ticket or clear bounded change"
---

1. Read the ticket, motivating stories and theory. Capture the starting ref. Return consequential gaps to `plan`.
2. Make the direct, obvious change. Treat code as a cost. Prepare the starting state and surface needed for first use; keep intended interaction in the story/spec until it can be tried.
3. Run existing regression tests and the project's deterministic and nondeterministic lints. Report unavailable checks honestly.
4. Hand off the changed behavior, runnable setup and affected stories to `verify-story`. Under a supervisor, leave acceptance to it; otherwise carry out that first-use pass. Guide and recording are written together against the actual product; assertions come from reviewing the encounter (`testing`).
5. Record encountered frictions and surprising costs with their originating story, observation and session (`tracker`). Commit coherent changes; report the project's size/complexity delta from the starting ref.

Prototype assignments use interactive feedback as review rather than this implementation verification pipeline. Reused prototype code enters the ordinary path when delivered as product code.
