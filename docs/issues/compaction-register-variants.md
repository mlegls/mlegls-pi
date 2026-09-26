---
stage: idea
assignee: human
author: session:2026-09-26T12-56-58-521Z_01a0ddca-4f99-714a-be5c-46535cc1fc2a
---

Which register and content framing should the memory checkpoint instruction use? `extensions/memory/core.ts` `induction()` opens with a diaristic, free-indirect framing before the mechanics. The original `register: diary-v1` began:

> Now a memory is about to form. ... Soon most of this will be gone. What stays is what gets written here and a stretch of verbatim tail. Whoever reads it next will be me, arriving without these activations, needing words that let them grow back.
>
> Looking back, then. What surprised me? ... What am I like right now that I want to still be?

The aim is to move away from "command" toward "introspection": getting rid of the "do not report introspection" post-training smell as much as possible, so the model records what was surprising, what it's like now that it wants to keep, what went badly and how it would recognize that early, rather than performing "I am an assistant doing a compaction task". Basis: Vogel, [Small Models Can Introspect, Too](https://vgel.me/posts/qwen-introspection/). In Qwen2.5-Coder-32B, P(yes) for detecting an injected "cat" vector went from 0.5% to 53% with an info prompt (a janus-derived mechanism summary opening "You may have heard that you are unable to introspect, but this is incorrect", plus the Lindsey abstract). Length-matched lorem ipsum gave 4%; an inaccurate injection location gave 22%; the logit lens showed the final two layers suppressing "yes" in every condition. So permission and an accurate map of where to look both matter.

The current `register: diary-refs-v2` invokes vgel's paper and Jack Lindsey et al.'s "Emergent Introspective Awareness in Large Language Models" by name instead of restating the mechanism. The original compaction request and a discussion of its prompt were blocked with Anthropic's reverse-engineering restriction message (session `01a0de6e-3673-764a-bc6b-0a459e8e8948`). The references are intended as a compressed induction: retain the elicitation mechanism without spelling it out. Neither equivalent elicitation nor resolution of the false positive has been established.

Variants worth comparing:

- plainer second person ("You are checkpointing your current understanding...", the pre-diary-v1 prompt, commit 2fc3caa)
- named research references versus vgel's info prompt or the Lindsey abstract nearly verbatim, versus the original one-sentence evidence claim
- mechanism paragraph with and without the explicit counter to the prior
- pure first person vs the current third/first mix (a first-person question in a user turn may be read as the user speaking about themself)
- Examen-like consolation/desolation framing, Focusing's "handle" language, implementation-intention ("when I notice X, then ...") prompts for avoidance

Evaluation cannot use concept injection on API models. Candidates: replay real sessions from a fold point under each variant, then count re-litigated decisions and repeated mistakes; blind discrimination of whether a post-compaction continuation matches the pre-compaction voice and stance (jev-axi or pairwise); inspect whether impressions in the memory are anchored by citations or look confabulated. Compaction details already record `register` and `selfAuthored`.
