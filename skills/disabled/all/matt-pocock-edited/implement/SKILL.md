---
name: implement
description: "Use when implementing work from an agreed spec or tickets."
disable-model-invocation: true
---

Build the agreed behavior. The spec's Shape explains the intended structure
and why it was chosen; it is enough context to improve the design, not a
transcription assignment.

Before substantial implementation, confirm the approach and scope (`grilling`).
A previously confirmed plan suffices while it still fits. Publication of new
conclusions or tracker changes needs the corresponding confirmation too.

1. Read the spec or ticket, its blockers and open questions, project guidelines,
   and relevant code. `theory-to-code` supplies an outside-in construction
   method when useful.
2. Use `testing` to close the missing parts of the story argument. Keep a fast
   feedback loop while implementing; choose test-first when the failure is
   informative.
3. Record the realized `via:` and actual evidence in the mapped stories
   document. Resolve questions the implementation answered. Note substantive
   departures from Shape and their reasons.
4. Use `code-review` for an independent look where it would add information,
   then `after-implementation` to verify and commit the coherent change.

A local implementation choice is yours. A discovery that changes the promised
behavior, scope, or accepted theory needs to return to the conversation. Record
useful friction as `difficult` rather than either hiding it or declaring every
large diff a theory crisis.
