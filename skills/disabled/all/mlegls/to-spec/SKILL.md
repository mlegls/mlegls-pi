---
name: to-spec
description: "Use when asked to turn an agreed conversation into an implementation spec."
disable-model-invocation: true
---

A spec carries settled intent across a context boundary. It preserves why the
shape was chosen while leaving implementation judgment intact. Synthesize the
conversation; an unanswered question stays visible rather than acquiring an
invented answer.

Read relevant code, stories, theory, and ADRs. Draft the spec, show it to the
user, and get confirmation before publishing to the tracker or durable docs
(`grilling`). The following are the useful parts, not mandatory empty sections:

- Problem: the user's present difficulty.
- Solution: what becomes possible or reliable for them.
- Stories: the agreed changes to the mapped story argument, with proposed
  `via:` and evidence. Proposed evidence is a plan, not a passing result.
- Shape: Shape Up's fat-marker drawing. Data structures and their reasons,
  then the flows they enable. `show-me` can express this as types, a tree,
  pseudocode, or a diff. An interface actually settled in discussion can be
  exact source; the rest need not pretend to be equally decided.
- Evidence: for a refactor, the preserved invariants and how to check them.
- Open questions and out of scope: only what implementation needs to inherit.

Link research and prototypes rather than preserving their transcripts. Holes
stay attached to the decision they can change. A question blocks readiness
when implementation cannot responsibly settle it inside the agreed scope;
otherwise it belongs to the implementing ticket.

`implement` can consume a spec directly. `to-tickets` is useful when separate
contexts or independently verifiable increments would help.
