---
stage: "done"
assignee: "agent:auto-routine"
priority: 2
author: "session:01a1ce05-15a3-7191-b6d9-27abd097297f"
part-of: "[[projects/mlegls-pi/issues/a-name-is-an-agent-with-its-soul-skills-and-life]]"
---
goal: a session attached to a registered machine-wide life is the named agent, with its soul, private skills, default virtual model and notes, through every pi launcher. Implement the runtime shape in [[projects/mlegls-pi/issues/a-name-is-an-agent-with-its-soul-skills-and-life#shape]].

## tasks

1. Extend [lib/agents.ts](../../lib/agents.ts) to parse a supplied soul file and resolve names through the settings registry on each use. Keep its existing stance and worker consumers working. Reuse the [stances registration and route](../../extensions/stances/index.ts) for `agent/<name>` without changing routing behavior.
2. Implement the agents extension and lesson section, ordered before [system-prompt](../../extensions/system-prompt/index.ts) in [package.json](../../package.json). The life's attachment is the only identity state. Connect startup/model-selection attachment through `life:attach` to [life](../../extensions/context/life/index.ts), exposing branch attachment as the parent specifies. A model selection in a session with messages only notifies; it never attaches history.
3. Load soul and private skills each run; render the agent section first and use the parent's identity-neutral harness opening. Make [notes](../../extensions/context/notes.ts) available to agents and include them by default in [mechanism selection](../../extensions/context/mechanism.ts), while honoring a session's `/memory -notes` and preserving non-agent behavior.

The parent's first-use story is acceptance: model startup (including BB's post-start model selection), life attach/off, model changes preserving identity, fresh skill edits, notes disabled globally but active for the agent, and private skills absent elsewhere. Prepare a runnable disposable fixture using the existing [life playground](../../scripts/life-playground.ts) or an equivalent small invocation for the driver; the durable guide and full two-session/BB encounter belong to [[projects/mlegls-pi/issues/named-agent-first-use-in-terminal-and-bb]].

## Drive evidence

[CLI and RPC encounter](../../docs/attachments/named-agent-runtime/index.md): attached startup, RPC post-start selection, life off/attach, model changes, live soul/skill edits, notes override and isolation observed. Explicit virtual-provider startup held; playground model shorthand friction is [[projects/mlegls-pi/issues/life-playground-model-override-keeps-anthropic-provider]]. Serialized prompt ordering/opening awaits reviewer inspection. Full BB encounter remains with [[projects/mlegls-pi/issues/named-agent-first-use-in-terminal-and-bb]].

## Result

done — the stories hold on head `d99a4999`. I repaired three things and one playground friction, and closed that friction's issue.

**Serialized prompt, which the driver couldn't observe.** pi projects the `systemPrompt` returned from `before_agent_start` onto the head of the request, so what `buildPrompt` returns is what the model gets. I called that handler with `sections.agent` set. The output is the soul and lesson first, then "You are working in pi, a coding agent harness. Show file paths clearly when working with files.", then the file-tools rule, skills, date and cwd. That is one identity claim. With no soul the old two-sentence opening is unchanged. I did not capture the wire request itself.

**Re-drive on a fresh fixture.**
- The driver's fixture imported its retired worktree, so I prepared a new one with `prepare-agent`.
- `--provider agent --model <name> --no-session` with no `PI_LIFE` answers `copper telescope` and says note is available.
- The default `one` launch also answers `copper telescope`.
- An unattached session's `toolsAdded` is read, bash, edit, write, journal and recall, with no `note`. The model said "Yes." to "is note available?", so the tool list is the evidence.

**Repairs** (all in `d99a4999`):
- A malformed `model:` in one SOUL made `agent()` throw inside `namedAgents`, which runs at extension load. That would have broken every pi launch on the machine. `lib/agents.ts` now skips that agent and logs it. I checked this with a bad and a good agent in one registry: only the good one registers.
- `mechanism.listed` now does the cheap `includes("notes")` check before reading the branch and soul.
- I removed a `process.env.PI_LIFE` check in `extensions/agents/index.ts`. It could never fire, because life deletes the variable at load. A `PI_LIFE` launch is already ignored by `startupName` in the life listener.

**Playground friction.** In `scripts/life-playground.ts`, a caller's `--model` or `--provider` now replaces the default pair. `--model agent/<name>` therefore reaches the agent provider, and I re-drove it. I closed the issue `life-playground-model-override-keeps-anthropic-provider` with that result.

I appended a Review section to `docs/attachments/named-agent-runtime/index.md`. The driver's log is untouched.

```yaml
commit: d99a4999 (branch head; driver packet 2f086b74)
stories:
  - {story: Attached agent receives soul, private skill and notes despite disabled global notes, outcome: held}
  - {story: Unattached session lacks private skill and note, outcome: held}
  - {story: Virtual-model startup and empty-session post-start RPC selection attach identity, outcome: held}
  - {story: Model changes preserve attached identity, outcome: held}
  - {story: Life off removes agent sections; explicit attach restores them, outcome: held}
  - {story: Selecting agent model after messages only notifies, outcome: held}
  - {story: Soul and private skill edits appear next turn without restarting, outcome: held}
  - {story: Session memory override disables notes, outcome: held}
  - {story: Final serialized prompt orders soul first with identity-neutral harness opening, outcome: held}
evidence:
  path: docs/attachments/named-agent-runtime/index.md
  visual: false
  shots: []
tests: []
filed: []
fixed:
  - "scripts/life-playground.ts: --model/--provider override the default pair (closes life-playground-model-override-keeps-anthropic-provider), d99a4999"
redrive: false
caveats:
  - "No `test:affected` task exists in this checkout. I ran `bun test extensions/context lib/agents extensions/stances extensions/system-prompt scripts`: 78 pass, 0 fail."
  - "The RPC late-selection, off/attach, live-edit and `/memory -notes` stories were driven on the driver's fixture before my repairs. My repairs don't touch those paths, and I re-drove only startup and isolation."
  - "attachedAgent() reads settings, SOUL.md and the branch on each call from notes `enabled` and mechanism `listed`. That is a small file-read cost per memory event in agent sessions, and non-agent sessions skip it when notes is already listed or settings.memory.systems is unset."
  - "A SOUL with a bad `model:` still throws from named() once the life is attached. This fails loudly in before_agent_start, but it can also throw from notes `enabled` and mechanism `listed`."
  - "The full BB and two-session encounter stays with named-agent-first-use-in-terminal-and-bb."
  - "My fixture /tmp/pi-life-Kg4K8k remains. No processes are left running."
```

Evidence: [docs/attachments/named-agent-runtime/index.md](../attachments/named-agent-runtime/index.md)
