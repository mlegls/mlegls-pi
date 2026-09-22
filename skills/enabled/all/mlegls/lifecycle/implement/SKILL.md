---
name: implement
description: "Use to make a bounded, agreed change."
argument-hint: "a ticket or clear bounded change"
---

1. Read the ticket, motivating stories and theory. Capture the starting ref. Return consequential gaps to `plan`.
2. Make the direct, obvious change and try it. Treat code as a cost. Write no new permanent acceptance tests as the implementer; temporary diagnostic experiments can inform the change. Prepare the starting state and surface needed for first use; keep intended interaction in the story/spec until it can be tried.
3. Run existing regression tests and the project's deterministic and nondeterministic lints. Report unavailable checks honestly.
4. Hand off the changed behavior, runnable setup and affected stories to `verify-story`. Under a supervisor, leave acceptance to its fresh verifier. Otherwise carry out a first-use self-check; dispatch a fresh verifier when independent acceptance is required. The verifier owns encounter-grounded guide and replay updates (`testing`); self-checks do not establish independent acceptance.
5. Record encountered frictions and surprising costs with their originating story, observation and session (`tracker`). Commit coherent changes; report the project's size/complexity delta from the starting ref.

Prototype assignments use interactive feedback as review rather than this implementation verification pipeline. Reused prototype code enters the ordinary path when delivered as product code.
