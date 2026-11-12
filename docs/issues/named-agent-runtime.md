---
stage: "ticket"
assignee: "agent:auto-routine"
priority: 2
author: "session:01a1ce05-15a3-7191-b6d9-27abd097297f"
part-of: "[[projects/mlegls-pi/issues/a-name-is-an-agent-with-its-soul-skills-and-life]]"
claimed-by: "reconcile:a-name-is-an-agent-with-its-soul-skills-and-life"
---
goal: a session attached to a registered machine-wide life is the named agent, with its soul, private skills, default virtual model and notes, through every pi launcher. Implement the runtime shape in [[projects/mlegls-pi/issues/a-name-is-an-agent-with-its-soul-skills-and-life#shape]].

## tasks

1. Extend [lib/agents.ts](../../lib/agents.ts) to parse a supplied soul file and resolve names through the settings registry on each use. Keep its existing stance and worker consumers working. Reuse the [stances registration and route](../../extensions/stances/index.ts) for `agent/<name>` without changing routing behavior.
2. Implement the agents extension and lesson section, ordered before [system-prompt](../../extensions/system-prompt/index.ts) in [package.json](../../package.json). The life's attachment is the only identity state. Connect startup/model-selection attachment through `life:attach` to [life](../../extensions/context/life/index.ts), exposing branch attachment as the parent specifies. A model selection in a session with messages only notifies; it never attaches history.
3. Load soul and private skills each run; render the agent section first and use the parent's identity-neutral harness opening. Make [notes](../../extensions/context/notes.ts) available to agents and include them by default in [mechanism selection](../../extensions/context/mechanism.ts), while honoring a session's `/memory -notes` and preserving non-agent behavior.

The parent's first-use story is acceptance: model startup (including BB's post-start model selection), life attach/off, model changes preserving identity, fresh skill edits, notes disabled globally but active for the agent, and private skills absent elsewhere. Prepare a runnable disposable fixture using the existing [life playground](../../scripts/life-playground.ts) or an equivalent small invocation for the driver; the durable guide and full two-session/BB encounter belong to [[projects/mlegls-pi/issues/named-agent-first-use-in-terminal-and-bb]].

## Drive evidence

[CLI and RPC encounter](../../docs/attachments/named-agent-runtime/index.md): attached startup, RPC post-start selection, life off/attach, model changes, live soul/skill edits, notes override and isolation observed. Explicit virtual-provider startup held; playground model shorthand friction is [[projects/mlegls-pi/issues/life-playground-model-override-keeps-anthropic-provider]]. Serialized prompt ordering/opening awaits reviewer inspection. Full BB encounter remains with [[projects/mlegls-pi/issues/named-agent-first-use-in-terminal-and-bb]].
