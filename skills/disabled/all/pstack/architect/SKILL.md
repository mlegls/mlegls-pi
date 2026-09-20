---
name: architect
description: "Use for /architect, “design this”, or when a spec or ticket leaves a module seam unresolved."
disable-model-invocation: true
---

# Architect

Design, don't implement: types, signatures, module seams, `not implemented` bodies. Vocabulary and criteria from the `codebase-design` skill.

1. **Ground.** Trace input to output through every system the change touches. If the design moves ownership or layering, recover the existing shape's rationale (`information-sources` skill) as a constraint. Skip only for greenfield work.
2. **Sketch.** Spawn parallel runners on `references/runner-prompt.md` plus the grounding, on distinct models where the harness offers them. Require at least two structurally distinct candidates, not variants of one shape. Screen each against `references/design-red-flags.md`; compare on interface depth, locality, and seam placement; take the strongest as base and graft from the rest. Candidates are throwaway, like `prototype` variants: one worktree each, kept on a throwaway branch with a pointer from the rationale's Synthesis decision.
3. **Deliver.** One synthesized package per `references/rationale-template.md`: caller's usage first, type sketch derived from it, module map for larger work, synthesis decision. Stop there; no "proceeding to fill in bodies."

Pushback on the shape is grounding evidence: redo 1 and 2. The synthesized sketch is not throwaway: it lands as the root commit of the feature branch (never on main directly) so `implement` fills bodies against a stable contract; `code-review` adversarial mode pressures it.

Implementation is the test of the sketch. Repeated same-shape friction (a workaround recurring across unrelated code, edge cases each needing a branch, types needing escape hatches, a simplification net-adding lines) returns here instead of being bolted around.
