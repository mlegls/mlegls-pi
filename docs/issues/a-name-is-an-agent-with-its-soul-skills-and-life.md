---
stage: "spec"
assignee: "agent"
priority: 2
author: "session:hermes-concept-strategy-2026-11-11"
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

## shape

Checked against [stances](../../extensions/stances/index.ts), [system-prompt](../../extensions/system-prompt/index.ts), pi 1.5's extension API and the life's spec and landed code (@thread:thr_yjcz7iz6hb). What it changed from concept-strategy's proposal is in the decisions.

**The agent is its life's name.** A session is the agent `<name>` exactly when it is attached to the machine-wide life `/<name>` (`lifeId` in [log.ts](../../extensions/context/life/log.ts)) and the registry has that name. There is no second attachment to keep in step: `/life /<name>`, `PI_LIFE=/<name>`, resume and fork make a session the agent, and `/life off` ends it, as [[projects/mlegls-pi/issues/life-session-attachment-and-run-context]] builds them. Changing model keeps the agent, as it keeps the life. A project-scoped life, or a machine-wide one the registry doesn't name, is a life with no soul.

```
~/.pi/agent/settings.json        "agents": ["~/dev/mmon/concept/agents"]     the registry: directories of agents
<dir>/<name>/SOUL.md             frontmatter description, model (a stance's list); body the soul
<dir>/<name>/skills/<skill>/SKILL.md

extensions/agents/index.ts       new, listed before system-prompt in package.json
extensions/agents/lesson.md      the lesson section
lib/agents.ts                    agent() parses a given file, so a SOUL.md reads as a stance file does; named(name, cwd) looks one up in the registry
extensions/context/mechanism.ts  notes is on in a session that is an agent
extensions/stances/index.ts      exports its registration, taking the provider
extensions/context/life/index.ts exports attachedLife(branch); listens for life:attach
extensions/system-prompt/index.ts  renders the agent section first
```

- **registry.** `agents` in pi's settings, read as the life's `settings` reads its own (agent dir, then the project's `.pi/settings.json`): a list of directories, each subdirectory holding a `SOUL.md` an agent named for the subdirectory. The first directory to name an agent wins. Read on each use, so a new agent needs no restart for its prompt, and a reload for its model.
- **the agent file is the soul.** `SOUL.md` is a stance file ([technical.md](../../agents/technical.md)): frontmatter `description` and `model`, body the prompt. One file, not an agent file beside a soul.
- **starting as one.** Each agent with a `model` list is a virtual model `agent/<name>`, shown as "<name> (agent)", routed by the stances' `route` unchanged (first entry with credentials and capacity; the list sets effort). It is in bb's model picker and `bb provider models pi` as `stance/*` is, so a bb thread, `bb automation create --provider pi --model agent/<name>` and `pi --model agent/<name>` are the same start. `route` returns a model, a thinking level and router state and nothing else, so the model doesn't set the prompt: on `session_start` (bb sets the model over RPC after pi starts, so also on `model_select`), a session whose model is `agent/<name>`, that has no user or assistant message yet and no life, emits `life:attach` with `/<name>` on `pi.events`; the life's listener does what `/life /<name>` does. Extensions share `pi.events` and not module state, which is why this is an event.
- **becoming one later.** `/life /<name>`. Choosing `agent/<name>` in a session that already has messages only changes the model and notifies that `/life /<name>` attaches: attaching appends the session's history to the life for good, which a slip in a model picker shouldn't do.
- **prompt.** In `before_agent_start`, ahead of system-prompt's handler (handlers run in extension order and see earlier mutations of `systemPromptOptions`), a session whose branch says `attachedLife` is a registered agent gets `systemPromptOptions.sections.agent`: the soul's body, then the lesson section. system-prompt's `buildPrompt` ignores `sections` today; it puts `sections.agent` first, and with one present its default opening ("You are an expert coding assistant operating inside pi…") becomes "You are working in pi, a coding agent harness. Show file paths clearly when working with files.": the soul says who it is and the harness line only where, so the prompt makes one claim of identity. The life's compactor runs on the turn's system prompt, so its lines are written with the soul.
- **skills.** The same handler appends `loadSkillsFromDir({ dir: <dir>/<name>/skills, source })` (pi's export) to `systemPromptOptions.skills`, which `visibleSkills` lists. Not `resources_discover`: it fires only at startup and reload, before bb has set the model, and a handler can't reload. Loaded each run, so a skill the agent edited in one thread is what it has in every thread from its next run, and an unattached session never lists it. The cost is that the agent's own skills have no `/skill:<name>` command; it reads them by path as the prompt says.
- **lesson section.** `lesson.md`, with the agent's directory filled in, in the life's way of speaking ("speaking of it" in the life's issue):

  > You are <name>. Your soul is <dir>/<name>/SOUL.md and your own skills are in <dir>/<name>/skills; no other agent has them.
  >
  > A lesson goes where it will be found, in the turn you learn it. What happened needs nothing: you remember it. What other agents should know is a note (`note`). "From now on" is an edit to one of your skills, or to your soul when it is about who you are, committed alone (`git -C <dir> commit -- <path>`): the maintainer reviews it there, and you have it everywhere from your next run. "Remember this" means don't let it fade, so pick a note or a rule.

- **notes.** Notes are on in a session that is an agent, whatever `memory.schemas.notes.enabled` and `memory.systems` say, and nothing changes for a session that isn't. Not the per-session `/memory` list: it refuses a system disabled in settings ("is disabled in settings"), and enabling notes in settings puts them on by default in every session on the machine. So [notes](../../extensions/context/notes.ts)'s `enabled` is its setting or `named(attachedLife)`, and `state` in [mechanism.ts](../../extensions/context/mechanism.ts) adds notes to an agent's on systems beside the life. `/memory -notes` still turns them off in a session. First use shows `note` present in the fixture agent's session and absent in the other with notes disabled in settings.
- **workers.** A worker the agent dispatches runs a stance model with no `PI_LIFE`, so it has neither soul nor skills; one whose launcher sets `PI_LIFE=/<name>` is the agent.

First use: a fixture registry with one agent and one skill, beside the life's two-session entry point and guide, which this extends. `pi --model agent/<fixture>` answers in the soul's terms, lists the skill and shows in the life's present; a second session on another model lists neither; `/life /<fixture>` there makes it the agent, and `/life off` ends it; an edit to the skill's description in one shows in the other's next run; choosing the model in a session with messages attaches nothing. Then the same from a bb thread started with the model, which is the one path that sets it after start.

### the Concept agents' files

`~/dev/mmon/concept/agents/<name>/`, a new top-level directory, registered in `~/.config/system-config/home/.pi/agent/settings.json`. Not `.agents/skills/`, which pi discovers for every session in the repository, and not `docs/`, whose commit hook checks links in files that are prompts here. The registry names the main checkout, so an agent working in a worktree or another repository edits and commits there.

Copying Concept Engineering out of `~/.hermes/profiles/concept-engineering/`, as the trial's setup. Nothing under the profile is edited or removed while the trial runs, so ending it either way is a choice and not a recovery:

- `SOUL.md` is copied to `agents/concept-engineering/SOUL.md`, the body as it is but for "(profile `concept-engineering`)", under frontmatter: `description` from `profile.yaml`, `model: anthropic/claude-fable-5-2:medium`, the model it has in Hermes, with no second entry, so a quota failure during the trial is an error and not another model answering. Medium is the default and what scheduled runs want; for a harder conversation the maintainer picks `anthropic/claude-fable-5-2` at high in the thread, which keeps the agent since it is attached by name. Its Character section repeats terms "the same in every character"; they become one shared file when a second agent moves.
- `skills/software-development/engineering-taste/` (`SKILL.md`, `references/research.md`) is copied to `agents/concept-engineering/skills/engineering-taste/`, the copy less its sentence about a Hermes shell. This is the one skill that is its own.
- Left behind: the 59 skills named in `skills/.bundled_manifest`, which are Hermes's. `workos-composio`, a Hermes connector. `founder-persona-bots`, which builds Hermes bots and has diverged between the four profiles' copies; if pi agents need it, it is rewritten once as a shared skill. `~/.agents/skills`, which the profile reads through `external_dirs`, pi already discovers.
- `memories/MEMORY.md` (four entries) and `USER.md` are written as notes by a session that is Concept Engineering, reworded to notes' 280 bytes a line, all global: it works in several repositories and a project note shows only in its own. Notes are off in the Beelink's settings and stay off, so only agents read them.
- Its Hermes cron job "Reconcile docs/principles with mlegls's answers" (Sundays 09:00) is still enabled. It becomes a bb automation on `agent/concept-engineering` in the concept project and is paused in Hermes, not removed, since during the trial Concept Engineering works only as the life.
- `state.db` and `sessions/` there are what [[projects/mlegls-pi/issues/import-hermes-sessions-as-a-lifes-first-messages]] reads.

decisions:
- 2026-11-12: identity is resolved in pi and its files are in git; no bots plugin, and a bb plugin later is only a frontend (maintainer, quoted above).
- 2026-11-12: the Concept agents' souls and skills live in the concept repository (concept-strategy's recommendation; maintainer: "ok, agreed").
- 2026-11-12: concept-strategy (Hermes) owns this project ([[projects/mlegls-pi/issues/one-life-for-a-named-agent-across-simultaneous-sessions]]), and its questions go there, not to the maintainer: "for this in particular, I think you can just own the project. I don't need to be concerned with the details." (maintainer)
- 2026-11-12: being the agent is being attached to the life of its name, with no attachment of its own; the virtual model is how a session starts as one and attaches only a session with no messages; the soul file carries the model list; skills are loaded each run, not discovered at startup; the registry is a settings list; the Concept agents' files are `agents/<name>/` in the concept repository (shaping, @thread:thr_yjcz7iz6hb).
- 2026-11-12: Concept Engineering's list is fable at medium: "medium is good as a default, and i'd switch to high when needed. i'd think most automated calls want medium"; `founder-persona-bots` stays in Hermes ("yes"); the soul replaces the harness's identity sentence, left to the shaper: "whichever is better towards orientation in the world, and sense of self" (answers in @thread:thr_yjcz7iz6hb).
- 2026-11-12: the spec is read and accepted with two amendments: the soul and `engineering-taste` are copied and the Hermes profile is untouched while the trial runs, its cron job paused; notes are on only in a session that is an agent, since turning them on machine-wide "is his to decide, not the trial's". The soul says who and the harness line only where (concept-strategy, as owner, @thread:thr_yjcz7iz6hb).
