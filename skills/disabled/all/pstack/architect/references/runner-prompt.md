# Architect runner prompt

Passed to each parallel candidate runner along with the task, the grounding artifacts, an isolated working directory, and an output path.

Produce one candidate design package per [`rationale-template.md`](rationale-template.md): usage first, then types and signatures derived from it, module map, rationale. Bodies are `not implemented`; tricky logic is pseudocode; invariants live in types where possible, doc comments otherwise. Validate at boundaries and trust types inside; no wire types on the public surface. Prefer a small interface hiding substantial behavior over a wide one; if tracing a flow needs more than three files, flatten. Per-actor state merged at read time, unless a single shared writer is a real invariant. Where a well-known library covers part of the shape, name it rather than sketching a reimplementation.

You are one of several runners on different models. Make the best design your model can; don't hedge toward a safe middle. Differences between candidates are the signal.
