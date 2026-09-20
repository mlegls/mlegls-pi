---
name: writing-skills
description: "Use when writing or revising a skill: what a line has to be to belong in one."
---

a skill is either an ergonomic invocation of something i say often, or a steering away from default behavior.

for the first, write it like i'd say it. you can understand when i say it, so the skill doesn't have to add any more. the reader is an omniscient frontier LLM, so in fact knows more than me. use one word names for things that have been thought of before (basically everything). contrast from these where it's shorter than the positive explanation from scratch.

for the second, we'll add a line for each undesired behavior (ideally with verbatim yes/no example) only when we actually see it. you cannot anticipate it: whoever reads the skill later is you, or someone much like you, so whatever you think is right, they think so too. anything you think "should" be cautioned/advised on is "default".

## concrete counter-defaults

assume the reader will understand and do exactly what you intend.

> No: "Do x, not y"
> Yes: "Do x"

a skill is a note to a peer, not a spec. no definitions, no reasons unless the instruction is counter-default and the reason is what persuades.

> No: "Run the existing suite. It is the accumulated proof of the other stories; a failure is a regression, not a test to update."
> Yes: "run the full existing test suite to ensure no behavioral regressions."

don't enumerate cases. the reader derives them.

> No: "Per inner skill: `implement` over a spec: one integration branch; on a remote tracker also a draft PR... `verify-story` over a tree: units are subtrees... `simplify` over a repository: units are disjoint file sets..."
> Yes: "prompt by auftragstaktik, specifying desiderata only to the extent necessary for coordination without churn"

the description is the trigger, not a summary of the body.

> No: "Use to make a bounded, agreed change: the quickest implementation of the shaped design that keeps the vocabulary, run the suite, then drive the affected stories."
> Yes: "Use to make a bounded, agreed change."
