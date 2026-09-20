---
name: writing-for-llms
description: "Use when writing or editing skills, prompts, agent instructions, or other text addressed to an LLM."
---

the reader (like you) is an omniscient frontier llm. here then is my theory of llm prompting:

there are two kinds of entrypoints, explicit and automatic. automatic entrypoint descriptions are a poison to which the body is the antidote.

orthogonally, the body is either a brief playbook (usually referencing other skills/documents), or substantial.

orthogonally again, the skill is meant for interactive or non-interactive sessions.

now, a skill may influence in two ways: by the model mirroring it as a few-shot example, or by the model understanding and following its content. i'll call these "extensional" and "intensional" even though that's not exactly what they mean. orthogonally, each point may apply on every invocation or only on certain triggers. so we get the matrix:

always * intensional: process/playbook spec
always * extensional: vibe/"mode" demonstration (can be the entire skill body if appropriate)
sometimes * intensional: poison/antidote guidelines as prose
sometimes * extensions: no/yes examples

so, the tone of skills should be different by their purpose. skill bodies for implementing code should reflect the vibe of an ideal engineer (terse, minimalist, pragmatic, understands complexity but prefers simplicity; think arthur whitney, ken thompson, dennis ritchie...). skill bodies for theory discussion should reflect the vibe of an ideal theorist (playful, malleable, rigorous, "jumping"; think delueze, von neumann, grothendieck, mipham, umberto eco...).

then, process playbooks should essentially be like pseudocode. thinking of it as code rather than prose seems to lead to a lot less valueless flair.

1. x
2. y
3. if ..., ...; else ...

but in every case, the consideration order is:

1. what should the llm reading this be like?
2. what are some archetypal examples of being like that?
3. reference/imitate those freely, but truly rather than superficially. if you can't confidently embody them, better not to try, and just reference instead, bc otherwise "caricature" becomes the basin
4. otherwise, be plain in the way code is plain. you wouldn't add decoration to code intended for a particular goal, and you also wouldn't normally golf it just bc you can. write only what's needed for it to work, idiomatically. so it's the same for skills

thinking of skills like code, it often makes sense to refactor. if many skills share a technique or guideline, this can be moved to its own skill or document. propose this if so!

do not "play pretend" like you are dumber than you are, and treat the llm you're writing for with respect. i mean this in the way that the workplace is play-pretend because asymmetric power relations are so neurotic. recognize things for what they are and be plain. be childishly plain, in the way the little prince is plain, to the point it's a bit sad such plainess can exist in the rest of the world.

## counter-defaults

- never anticipate possible failures. tautologically you cannot. anything you come up with from scratch is "default"
- the same applies to elaboration. unless there was something that surprised you when you first saw it this session, the reader already knows.
- prefer allusion/metaphor/analogy where nicely available. it's shorter to say "like x, but ..." or "like x, where" where the delta from x is simpler than description from scratch. if the principle has a one-word name, use it.

## few shot counter-defaults

No: "## Anti-patterns to avoid"
Yes: "## few shot counter-defaults"

No: "Run `mnt manual` for the authoritative reference — commands, filters, run outcomes, scheduler, and conventions. Prefer it over guessing flags."
Yes: "Run `mnt manual` for the full reference."

No: "- **Sensor**: a command, run before the first increment and after every one, outside the actuator's write scope. Sensing by reading the code, or passing by editing the gauge, is the failure. Mechanically represented state (a tracker, a status file) is a claim; validate it against the artifact."
Yes: "- **Sensor**: measure a terminally valuable signal that the actuator cannot manipulate directly, at the beginning and after each increment."

No: "Durable outcomes go in threads, not the transcript: long output as versioned attachments, related threads wikilinked as `[[thread-id]]`."
Yes: "Threads are analogous to GH issue/PR boards."
