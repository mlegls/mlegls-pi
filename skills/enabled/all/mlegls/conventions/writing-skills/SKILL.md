---
name: writing-skills
description: "Use when writing or revising skills, or any agent-facing prompts/instructions/documentation"
---

think of skills subtractively, like sculpting. we're constraining the possibility space of what the agent might do.

consequences:

- positive statements are coarse cuts (cutting away everything-but); negative statements are fine cuts
- never "cut air". consider for every word/phrase if it's actually a meaningful cut through the remaining space
- you only need to cut away what's undesirable. whether you need to make each extra cut depends also on the capability/nature of current models
- form, then cut. try the tersest "forming" first, via one-word or citational pointers and analogies. then cut only undesired behavior that's actually observed, via verbatim no/yes examples when available.
- the future reader is you or much like you. never pre-empt failure modes, and only write down what's unique to the current context, that you couldn't have known before, or that surprised you. any elaboration you can think of from scratch, the reader would too.

## concrete counter-defaults

assume the reader will understand and do exactly what you intend.

> No: "Run the existing suite. It is the accumulated proof of the other stories; a failure is a regression, not a test to update."
> Yes: "run the full existing test suite to ensure no behavioral regressions."

don't enumerate cases if they can be easily found/derived.

> No: "Per inner skill: `implement` over a spec: one integration branch; on a remote tracker also a draft PR... `verify-story` over a tree: units are subtrees... `simplify` over a repository: units are disjoint file sets..."
> Yes: "prompt by auftragstaktik, specifying desiderata only to the extent necessary for coordination without churn"

the description is only a trigger

> No: "Use to make a bounded, agreed change: the quickest implementation of the shaped design that keeps the vocabulary, run the suite, then drive the affected stories."
> Yes: "Use to make a bounded, agreed change."
