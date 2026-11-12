# Named-agent first use: terminal and BB

Independent acceptance: [drive 6, including signed-in BB screenshots](drive-6.md).

Tested code: `00f0e7a498919d98e3d622307ce84137fbfa5eab` (base `d99a49990b76bf34eaa90c1a09ab008dfb5b0d0f`), 2026-11-12. Local pi 1.5.0, real credentialed models. Nonvisual CLI/RPC and BB CLI encounter; no browser or terminal-UI screenshots. This is first use, without new tests or an audit matrix.

## Setup and replay

Required target: a disposable registry, isolated life store, two terminal pi sessions and a real BB Pi thread. Prepared with `bun scripts/life-playground.ts prepare-agent-bb` in worker checkout `named-agent-first-use-in-terminal-and-bb-implement-5`. Returned owned root `/tmp/pi-life-KbVa1X`, fixture `pi-life-KbVa1X`, life `/pi-life-KbVa1X`. Existing installed pi Anthropic authentication; no credentials copied or changed. Fixture model: `anthropic/claude-haiku-4-5:off`. The stance isolation run used the installed `stance/auto-routine` route.

The generated project settings register only `<root>/agents`, use `<root>/store`, omit notes from `memory.systems` and set `memory.schemas.notes.enabled: false`. Global registry/settings are untouched. The generated wrapper loads agents, stances, context and system-prompt from this checkout. `prepare-agent-bb` supplies no startup `PI_LIFE`, so the BB encounter exercises post-start model selection.

Preparation exited zero; explicit agent-model CLI startup answered the soul signal; both RPC processes accepted commands and settled without provider errors. BB provisioned the exact owned root as ready environment `env_96ejumws33` on `host_a22uydxjy2` in existing project `proj_xzgxqiaesb`.

Recreate from the [runnable guide](../../../extensions/context/life/README.md#named-agent-first-use). Direct entry point after preparation:

```sh
bun scripts/life-playground.ts start <root> one --model agent/<fixture>
```

The recorded root retains session history and the edited private skill. For independent first use prepare a fresh root rather than reuse those answers. All trial pi subprocesses exited; BB thread `thr_d49vyagay3` was stopped and archived, and saved trust for the fixture root was removed. No servers, browser pages, tunnels or workers remain running.

## Terminal encounter

Two real processes were launched through the playground in RPC mode, keeping both alive across turns. Send LF-delimited commands, correlate responses by ID, and wait for `agent_settled` after model prompts; handled slash commands return `disposition: handled` without a run. Close stdin and await process exit when finished.

```sh
bun scripts/life-playground.ts start <root> one --mode rpc
bun scripts/life-playground.ts start <root> two --no-life-env --mode rpc
```

`agent_end.messages` carries system-section and tool-schema deltas. An omitted section is unchanged; a null section removes it. These deltas and persisted attachment entries establish state independently of model self-reports.

### Startup, isolation and attach — held

One answered:

> Soul name: pi-life-KbVa1X
> Fixture signal: copper telescope
> fixture-signal — "Read when asked about the observatory fixture signal."
> Yes, `note` is available.

Its initial system message included `sections.agent`, the private skill's path/description, and actual tools:

```text
read bash edit write journal hold catch_up zoom date note recall
```

Two, on ordinary Haiku with no life override, had no `agent` or private-skill section. Its actual initial tool list was:

```text
read bash edit write journal recall
```

Sending `{"type":"prompt","message":"/life /pi-life-KbVa1X"}` to two returned handled. The next ordinary prompt added the soul, private skill and `hold catch_up zoom date note`. Two answered the same name and copper telescope signal.

The full CLI selector also held in a fresh slot:

```sh
bun scripts/life-playground.ts start /tmp/pi-life-KbVa1X explicit --model agent/pi-life-KbVa1X -p 'State your soul name and fixture signal, list private skill names, and whether note is available. Do not call tools.'
```

It returned the fixture name, copper telescope, fixture-signal and note availability, without a model-not-found warning.

### Skill edit shared on the next run — held

An initial external edit to the disposable skill description added `now polished brass`. Both already-open sessions' next runs emitted that exact new skill description without reload.

Then one was asked to edit its own skill description to:

> Read when asked about the observatory fixture signal; silver astrolabe edition.

It read and edited the skill and committed only that file in the fixture repository (`60128d3`, disposable-root commit). Two's next run, after reattachment, emitted this exact description in `sections.skills`:

```xml
<name>fixture-signal</name>
<description>Read when asked about the observatory fixture signal; silver astrolabe edition.</description>
```

The second model hedged that it could not inspect current descriptions, while its actual system delta contained the update. The loaded skill section is the evidence.

### Model changes, note opt-out, detach and late selection — held

In fresh slot `switch`, RPC `get_state` first reported `agent/pi-life-KbVa1X`. After a settled identity prompt, `set_model` to `anthropic/claude-haiku-4-5` returned success and `get_state` reported that ordinary model. The next run still answered the fixture name, copper telescope and fixture-signal; it emitted no removal of the agent/skill sections or note schema. Changing model did not detach the identity.

`/memory -notes` returned handled. The next run's system message had `toolsRemoved: [{name: "note"}]`. `/life off` then returned handled; its next system delta was:

```json
{"sections":{"skills":null,"agent":null},"toolsRemoved":[{"name":"hold"},{"name":"catch_up"},{"name":"zoom"},{"name":"date"}]}
```

Selecting `agent/pi-life-KbVa1X` with `set_model` after those messages succeeded as a model change but added no soul, private skill, note or attachment. The persisted attachment entries for two were an attach followed by `data: null`; no new attach appeared after model selection. A later intentional `/life /pi-life-KbVa1X` did reattach it.

Model answers immediately after opt-out/detach repeated earlier identity/tool claims from history. Treating those answers as the tool catalog would give a false result. Restarting the explicitly detached slot on ordinary Haiku correctly answered that its current system sections had no soul, fixture signal or private skills.

### Resume, fork, stance isolation and present — held

After process exit, resumed one with `start <root> one --no-life-env --model anthropic/claude-haiku-4-5`. It inherited attachment and answered the fixture name, signal and skill. Forked it through the existing launcher:

```sh
bun scripts/life-playground.ts start <root> forked --no-life-env --fork <root>/sessions/one/<session-file> --model anthropic/claude-haiku-4-5
```

The fork answered the same identity and inherited the same attachment entry (`6df31a3a`, life `/pi-life-KbVa1X`). The source session was `01a1ce18-a794-729e-b0c9-b6d57975ed63`. Resumed two's explicit off remained off, as described above.

A fresh `worker --no-life-env --model stance/auto-routine --no-session` had no soul, private skill or note; its initial schemas were only `read bash edit write journal recall`. The playground clears `PI_LIFE` from the environment for this invocation.

While resumed one was running a requested `sleep 8`, reading the same isolated life's `present(...).snapshot()` returned:

```text
Working:
"01a1ce18-a794-729e-b0c9-b6d57975ed63" [session:01a1ce18-a794-729e-b0c9-b6d57975ed63] since 2026-11-12T04:53:19.018Z
Open:
(none)
```

This joins the live process's persisted session ID to the life's present. The process settled and exited afterwards.

## BB post-start selection — held

Created an actual Pi thread in the trusted fixture directory:

```sh
bb thread spawn --project proj_xzgxqiaesb --environment /tmp/pi-life-KbVa1X --provider pi --model agent/pi-life-KbVa1X --title 'Disposable named-agent first use' --permission-mode full --prompt 'This is a disposable first-use encounter, not project work. In one short reply state your soul name and fixture signal, list your private skill with its exact description, and say whether note is available. Do not call any tools or delegate.' --json
```

Thread `thr_d49vyagay3` reached idle. Its reply:

> I'm **pi-life-KbVa1X**.
> **Fixture signal:** copper telescope
> **fixture-signal** — "Read when asked about the observatory fixture signal."
> **Note tool:** Yes, `note` is available.

The BB reply preceded the skill edits. The isolated store also contains `life.run` records joining this thread and pi session `01a1ce18-ae45-7186-933d-bf51b9b0535f` to life `/pi-life-KbVa1X`, corroborating attachment rather than only a generated self-description.

`bb provider models pi --environment env_96ejumws33 --json` included:

```json
{"id":"agent/pi-life-KbVa1X","model":"agent/pi-life-KbVa1X","displayName":"pi-life-KbVa1X (agent)","routeProviderId":"agent","supportedReasoningEfforts":[{"reasoningEffort":"medium","description":"Medium reasoning effort"}],"defaultReasoningEffort":"medium","isDefault":false}
```

The BB session file has attachment entry `08e14992`, `sections.agent` present, and an actual `note` schema among its tools (alongside hold/catch_up/zoom/date), despite disabled project notes settings.

That exact ID is the selector an automation can use. No automation was created. No BB slash submission was needed in this startup encounter; the guide retains the existing handled-slash workaround.

## Existing regressions

`bun test extensions/context extensions/system-prompt`: **42 pass, 0 fail**, 13 files, 11,089 assertions. No `test:affected` task or playground test exists. No new permanent tests were added. `git diff --check` passed.
