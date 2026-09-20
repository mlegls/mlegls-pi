# Architecture as an experiment

Make the proposed interfaces, ownership, and composition inspectable as code.
Representative outer operations expose what the theory lets a caller say;
one difficult flow may reveal more than a complete miniature implementation.

Use a throwaway worktree when existing types and build configuration matter,
or scratch when the current package layout would bias the answer. Record the
baseline and commands needed to reproduce the experiment.

1. Write the outer operations in theory terms and recurse far enough to expose
   ownership, dependencies, effects, and failure.
2. Keep the sketch type-correct. Typed declarations, ports, or in-memory
   implementations can stand for depth the question does not require. Label
   what is modeled; execute the portions whose behavior is the evidence.
3. Generate the relevant interface outline, import graph, or execution trace
   from the code. A visualization of the intended design alone cannot show
   whether that is the design the code actually expresses.
4. Compare alternatives with the same analysis when alternatives are useful
   (`variety`). Let the result change the candidate.

The abstractions are the experiment. Disposable executable checks are useful
when they establish a proposed law; production scaffolding is not useful merely
because a normal implementation would eventually need it.

Return the answer, source location and retained revision, entry points,
commands, and evidence. Link them from the hypothesis or spec. Production
inherits the validated decisions through `to-spec` or implementation, while the
mapped architecture document continues to describe existing production code.
