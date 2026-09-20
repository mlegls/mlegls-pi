---
name: theory-to-code
description: "Use when implementing an accepted theory or interface sketch, or explicitly asked to prototype a target architecture."
---

SICP's wishful thinking: write the sentence the caller should be able to say,
then make the language in which it is true. The accepted theory, glossary,
interface sketch, and affected code are the starting material.

1. Choose one real caller-visible behavior. Write its outer operation in
   theory terms, invoking operations that ought to exist.
2. Give those operations contracts and recurse until the implementation is
   familiar language, library, or repository machinery.
3. Turn around and realize the deepest operations, composing upward until the
   outer sentence runs. Let implementation facts improve the sketch.
4. Carry one behavior through the whole path before widening. Update the
   mapped architecture document from what the code actually became.

Representations come first. Structural laws can supply operations and remove
invalid states without requiring a generic algebra framework. A local
transformation can stay local; a deep module earns its boundary by what callers
no longer need to know.

An elegant call site that conceals important cost, effects, or failure is not
an elegant interface. Friction returns to `architecture`, not to an expanding
collection of exceptions beneath the sketch.

For an explicitly exploratory request, use
[prototype mode](references/prototype.md). For production, `implement` owns the
surrounding testing, review, and delivery workflow; this skill is the method of
construction, not another implementation lifecycle.
