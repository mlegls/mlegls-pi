---
name: writing-skills
description: "Use when writing or revising skills, or any agent-facing prompts/instructions/documentation"
---

think of skills subtractively, like sculpting. we're constraining the possibility space of what the agent might do.

consequences:

- positive statements are coarse cuts (cutting away everything-but); negative statements are fine cuts
- never "cut air". consider for every word/phrase if it's actually a meaningful cut through the remaining space
- you only need to cut away what's undesirable. whether you need to make each extra cut depends also on the capability/nature of current models
- skills can never add to the possibility space. it's largely useless to try to "teach" something broad that's not already parametrically learned. skills are entirely different from explanations to humans in this. the tersest pointer to a space-region has exactly the same effect as an elaborated explanation.

## concrete counter-defaults

assume the reader will understand and do exactly what you intend.

> No: "Run the existing suite. It is the accumulated proof of the other stories; a failure is a regression, not a test to update."
> Yes: "run the full existing test suite to ensure no behavioral regressions."

don't enumerate cases if they can be easily found/derived.

> No: "Per inner skill: `implement` over a spec: one integration branch; on a remote tracker also a draft PR... `verify-story` over a tree: units are subtrees... `simplify` over a repository: units are disjoint file sets..."
> Yes: "prompt by auftragstaktik, specifying desiderata only to the extent necessary for coordination without churn"

the description only is a trigger

> No: "Use to make a bounded, agreed change: the quickest implementation of the shaped design that keeps the vocabulary, run the suite, then drive the affected stories."
> Yes: "Use to make a bounded, agreed change."
