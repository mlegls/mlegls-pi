---
stage: idea
author: "session:01a14e7f-a8d1-74b9-a802-0b9ba1d30c3f"
---

`lib/lint` (jev-lint, 2026-09-21 to 09-24) ranked what a change added over a ref with Jev: inert fields, assertions the concept notes never promise, type predicates that recheck their argument's type, and concept-note sentences the diff contradicts (`drift`, `d00ae632`; calibrated on Concept, where real contradictions ranked first and unrelated commits stayed at or below 0.2). It was advisory, never a gate, TypeScript only. It left with the rest of the prototype in `b40cdecd` ("Cut to the confirmed core", 2026-10-01; reachable at the `prototype` tag), not on a judgment of its findings; nothing recorded how useful they were.

Pi 0.99 now offers Jev classifiers natively (`models.classify()` in codemode, with cost counted), so a rebuild needs only extraction and the prompts, not its own client. The drift check is the part Concept misses most: a design-docs ticket on 2026-10-19 wanted a no-drift verdict and had to substitute a source review.

Decide whether to bring it back, and in what scope (drift alone, or the span findings too), after measuring how often the old queue's top findings were real on the prototype tag's recorded runs.
