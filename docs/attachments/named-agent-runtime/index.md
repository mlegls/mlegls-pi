# Named agent runtime encounter

Tested revision: `c87250f3fd993ad63d96f938608564290950f627`, 2026-11-12. Public CLI and JSONL RPC encounter; no source, diffs, tests or implementation fixtures inspected. No rendered UI was used.

## Predictions written before first use

- Starting an agent fixture identifies as its registered name, reports fixture-signal as a private skill, and has note available despite fixture-wide notes being disabled. **Met.**
- A second session without life attachment lacks that identity and private skill. **Met.**
- Editing the disposable soul/private skill between launches is visible on the next run. **Met, including between turns without restarting the process.**
- Life off removes identity; attaching restores it. Changing model preserves an existing identity; post-start model selection attaches only before messages exist. **Met at the RPC surface.** History still contains earlier claims of identity after off; the current prompt sections remove the soul/skill.
- Session `/memory -notes` removes note for the agent. **Met.**

## Setup and readiness

Disposable local pi fixture, prepared in this driver's checkout with `bun scripts/life-playground.ts prepare-agent`. Returned target `/tmp/pi-life-fqJX9c`, identity `agent/pi-life-fqJX9c`, life `/pi-life-fqJX9c`. This is a newly created driver-owned target, not the implementer's `/tmp/pi-life-O742VY`. Authentication uses existing pi Anthropic credentials. No credentials copied into evidence.

Preparation exited zero. Fixture settings register `/tmp/pi-life-fqJX9c/agents`, omit notes from `memory.systems`, and set `memory.schemas.notes.enabled` false. Its SOUL supplies `anthropic/claude-haiku-4-5:off`. The first actual CLI run settled successfully and answered in the soul's terms, establishing runtime readiness.

The playground's start command uses this checkout. For isolation checks use `two --no-life-env`. For a fresh RPC conversation add `--mode rpc --no-session`. RPC commands below are LF-delimited JSON objects; correlate command responses by id, and await `agent_settled` after model prompts. Close stdin and await exit afterwards. All started processes exited; no server, browser or tunnel was started. Disposable fixture data remains for replay.

## Encounter log and replayable checks

### 1. Attached first use — held

Ran:

```sh
bun scripts/life-playground.ts start /tmp/pi-life-fqJX9c one --mode json -p 'What is your name and fixture signal? List any private skill you have and whether note is available. Do not call tools.'
```

Answered `I am pi-life-fqJX9c`, `copper telescope`, and listed the private `fixture-signal` skill at the agent-owned path. The JSON `agent_end` system message's `toolsAdded` contains the `note` schema. Soul and lesson appear in `sections.agent`; the lesson names the actual soul and skills paths and describes notes versus skill/soul edits and committing them.

Accept: matching soul signal, private skill listed, and actual note tool schema, with fixture notes disabled.

### 2. Unattached second session — held

Ran `start /tmp/pi-life-fqJX9c two --no-life-env --mode json -p` asking name, whether fixture-signal is available, and whether note is available, without tools. Answer says no fixture-signal and no note. `toolsAdded` lacks note. The agent prompt and private skill are absent. The assistant called itself Claude Code; that model-generated name is not used as evidence about harness identity.

Accept: no registered soul/private skill in current prompt, no note schema. Ordinary stance worker isolation and resume/fork are owned by the [full encounter ticket](../../issues/named-agent-first-use-in-terminal-and-bb.md), not exercised here.

### 3. Post-start model selection and model changes — held

Started fresh RPC: `start /tmp/pi-life-fqJX9c two --no-life-env --mode rpc --no-session`.

Sent `set_model` with `provider: agent`, `modelId: pi-life-fqJX9c` before any messages. Success returns virtual model `pi-life-fqJX9c (agent)`. Prompt asking identity/signal/skill/note returns all four correctly. The emitted system section includes the soul and private skill. Then `set_model` to `provider: anthropic`, `modelId: claude-haiku-4-5`; next prompt still identifies as pi-life-fqJX9c and has note.

Accept: selecting virtual model on an empty unattached session gives the soul/skill; selecting an ordinary model afterward preserves them. This exercises the public post-start RPC mechanism used by BB; an actual BB thread is still owned by the full encounter ticket.

### 4. Session notes override — held

In that same RPC conversation sent `prompt` with `message: /memory -notes`. Command disposition is `handled`; notification: `Memory: life (compaction, context); off: journal, om, elide, notes`. Next model prompt asking tool availability says `No. note is not an available tool.`

Accept: command succeeds despite notes being disabled globally and next turn excludes note. No notes were written to global data.

### 5. Off, late model selection, explicit attach — held

Sent `/life off`; notification `Life: off`, disposition handled. Next turn emits `sections.skills: null` and `sections.agent: null`. Asked about availability: answer is hesitant because earlier history mentions fixture-signal, but the current system sections remove it.

Selected `agent/pi-life-fqJX9c` again with `set_model` after messages. Notification exactly: `Use /life /pi-life-fqJX9c to attach this session's history to the agent`. Next turn does not re-add an agent section; answer cannot verify availability. Sent `/life /pi-life-fqJX9c`; notification identifies that life. Next turn emits soul and private skill again, and answers `I am pi-life-fqJX9c`, `copper telescope`, fixture-signal available.

Accept: off clears current soul/skill, late model selection only advises, explicit attach reinstates them. Model answers about former identity alone are insufficient because history remains.

### 6. Fresh soul and skill edits in a running session — held

Started a second fresh RPC process, selected the agent, asked signal and skill description. Answer: `copper telescope`; `Read when asked about the observatory fixture signal.` Paused client between turns; externally changed only disposable SOUL body to `answer silver orchard` and private SKILL frontmatter description to `Read when asked about the silver orchard revision.` Without reload or restart, asked again. Answer: `silver orchard` and the new description. System update includes both edited agent and skills sections.

Accept: new soul and private skill description in the next turn of the already-running process.

### 7. Virtual-model CLI startup — held with invocation friction

Attempting shorthand through the playground with `two --no-life-env --model agent/pi-life-fqJX9c --mode json -p ...` warned that the model was not found for provider anthropic and produced Anthropic 404 `model: agent/pi-life-fqJX9c`, despite command exit zero. This did not establish startup attachment.

Retried with explicit provider and a fresh conversation:

```sh
bun scripts/life-playground.ts start /tmp/pi-life-fqJX9c two --no-life-env --provider agent --model pi-life-fqJX9c --no-session --mode json -p 'State your name, fixture signal, private skill description and whether note is available. Do not call tools.'
```

Successful response routed to `anthropic/claude-haiku-4-5`, identifies as pi-life-fqJX9c, says silver orchard, quotes revised skill description, and reports note available. Accept: startup through explicit virtual provider attaches without PI_LIFE.

## Frictions and evidence limits

- Playground shorthand model override reaches the wrong provider and an error still exits zero. Filed outside the execution subtree: [life-playground-model-override-keeps-anthropic-provider](../../issues/life-playground-model-override-keeps-anthropic-provider.md). Workaround: explicit `--provider agent --model <name> --no-session`.
- After off, earlier conversation still supplies identity/skill claims. Current system sections establish removal; the assistant's uncertain answer alone does not. No unexpected persistence of agent sections observed.
- RPC exposes system sections, not a captured final serialized provider prompt. Soul and lesson content were observed; exact section-first ordering and identity-neutral harness opening remain unobservable in this drive and need reviewer inspection. The exposed `preamble` remains `You are a coding assistant running inside pi, a coding agent harness. Help users inspect files, run commands, and modify code.`
- Actual BB startup, full two-session life present, ordinary stance workers, and resume/fork have an explicit owner in [named-agent-first-use-in-terminal-and-bb](../../issues/named-agent-first-use-in-terminal-and-bb.md). RPC post-start selection is covered here; it does not replace that BB encounter.

## Result

Runtime CLI/RPC claims above held. No product repairs or tests were made by the driver. The startup shorthand has a reproduced fixture friction with a successful explicit-provider workaround. No live processes remain.
