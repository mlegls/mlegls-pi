---
stage: "goal"
assignee: "agent"
priority: 2
author: "session:hermes-concept-strategy-2026-11-11"
blocked-by:
  - "[[projects/mlegls-pi/issues/one-life-for-a-named-agent-across-simultaneous-sessions]]"
---
idea: "How would Hermes's kind of SOUL.md and per-profile skills relate to what we're building here? For persistent identities in BB, do we want to use one of BB's existing bots plugins, or build our own plugin, or neither?" Concept-strategy answered neither: a small pi extension that resolves a name to a soul, skills, a life and a default model, with the files in git. "ok, agreed. a bb plugin would just be a frontend to this then, like the relation between our tracker plugin and issues system." (maintainer, 2026-11-12, Hermes concept-strategy desktop session `20261111_184900_7d1d9e`). Earlier there: "agent-scoped skills could also be implemented as a pi extension or bb plugin."

goal: in pi a name is an agent: its soul, its own skills, its life ([[projects/mlegls-pi/issues/one-life-for-a-named-agent-across-simultaneous-sessions]]) and its default model. A session started as that agent is the same one whether a bb thread, a schedule or a terminal started it. This is what a Hermes profile gives the four Concept agents today, less the memory the life replaces. Its first use is [[projects/mlegls-pi/issues/concept-engineering-runs-as-a-life-on-the-beelink]].

- **soul.** One short file, always in the prompt.
- **skills.** The agent's own directory beside the shared ones. Another agent doesn't see it.
- **where a lesson goes.** A prompt section saying so, and to write it in the turn it is learned: what happened needs no act (the life), what other agents should know is a note ([notes](../../extensions/context/notes.ts)), and "from now on" edits a skill or the soul. Hermes's base prompt does this, and concept-strategy's account of why a correction held there was this text and not its memory mechanism.
- **in git.** The agent edits its own soul and skills by committing, so the maintainer reviews them and simultaneous manifestations coordinate through git.
- **anywhere.** The Concept agents' files live in the concept repository, since they belong to mmon Co. (concept-strategy's recommendation, agreed), and the agents work in several repositories. So a name resolves through a registry, not the session's checkout.
- **facts.** Nothing per-agent replaces Hermes's `USER.md` and `MEMORY.md`: what they hold is true for every agent (four profiles each keep a copy today) and belongs in notes.

Out: a bb plugin. Later it is a frontend that stores nothing: threads grouped by agent, starting one as an agent, the life's present. Out: what Hermes has natively and pi doesn't (browser and desktop use, connectors, the login vault); an agent that needs those stays reachable in Hermes.

## proposed shape

By concept-strategy, from the header of [stances](../../extensions/stances/index.ts) only. Where the code disagrees, the code wins.

- An agent is a directory: an agent file like a stance's ([technical.md](../../agents/technical.md): name, description, model list), `SOUL.md` and `skills/`.
- It is exposed the way stances are, as a virtual model, so bb's model picker starts a thread as the agent and its model list picks the LLM. Not confirmed: that selecting a virtual model can also set the prompt and the skills.
- Selecting it puts the soul and the lesson section in the prompt, adds its skill directory, and attaches the life of the same name.

holes, for shaping:

- how an agent is selected (virtual model, environment, command) and what a session not started as one can do to become one.
- where the registry is.
- which of a Hermes profile's `skills/` are the agent's own: `~/.hermes/profiles/concept-engineering/skills/` also holds Hermes's bundled ones.

decisions:
- 2026-11-12: identity is resolved in pi and its files are in git; no bots plugin, and a bb plugin later is only a frontend (maintainer, quoted above).
- 2026-11-12: the Concept agents' souls and skills live in the concept repository (concept-strategy's recommendation; maintainer: "ok, agreed").
- 2026-11-12: concept-strategy (Hermes) owns this project ([[projects/mlegls-pi/issues/one-life-for-a-named-agent-across-simultaneous-sessions]]), and its questions go there, not to the maintainer: "for this in particular, I think you can just own the project. I don't need to be concerned with the details." (maintainer)
