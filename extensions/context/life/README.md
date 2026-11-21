# Life

Attach with `/life <name>`; `/life off` detaches; `/life` shows the current attachment.
A bare name belongs to the git repository (all its worktrees share it). `/life /<name>` is
machine-wide. Resume and fork inherit the attachment entry, including an explicit off.
Changing model keeps the attachment. Existing optmem records remain unread.

`PI_LIFE=<name> pi` attaches at startup. Life deletes `PI_LIFE` from its process environment
when reading it, so children use OM unless their launch explicitly names a life:

```sh
PI_LIFE=/concept-engineering pi
# An explicitly named worker:
PI_LIFE=/concept-engineering pi --print 'Read the issue and report what is missing.'
```

Attached sessions use life for compaction and context. Otherwise OM is the default; `/memory`
still selects other systems. Notes compose with life; they are on unless
`memory.schemas.notes.enabled` is false.

Each run sees a fixed shared view, the present, and its current work whole. Completed runs
elsewhere enter the next run's view. Tools available while attached:

- `hold({text})`: one line of what you hold here; empty text clears it.
- `catch_up({})`: committed leaf lines since the current view, with their places.
- `catch_up({thread})`: your unfinished run in that bb thread, whole.
- `zoom({id,n})`: open a summary; `n: 1` gives the copied message and source.
- `date({id})`: source date/time. Zoom and date also reach newer committed positions.

Settings live in `memory.schemas.life`: fanout, view and compactorView byte budgets,
concurrency, retries, waitSeconds, tailBytes, model, systemPrompt, cut and scorer.
An unset model uses the turn's. A long run commits a complete prefix before moving its
boundary; its user's message stays whole.

## First use

From the checkout under test:

```sh
bun scripts/life-playground.ts prepare
bun scripts/life-playground.ts start <root-from-prepare> one
bun scripts/life-playground.ts start <root-from-prepare> two
```

These launch real terminal pi processes on one temporary store and machine-wide name, with
notes enabled and `tailBytes: 800`. Authentication is the installed pi's existing Anthropic
credential; the default model is Haiku 4.5. Extra pi options follow the slot. The launcher
approves its own generated project and loads only this checkout's context extension.

Use `--no-life-env` to omit the startup override: a new slot starts unattached, and a resumed
slot keeps its persisted choice. For example, give a new unattached slot some history, then
attach it with `/life /<name-from-prepare>`. To fork, pass
`--no-life-env --fork <session-file>`.

For bb, use `prepare-bb` instead. It saves trust for that owned temporary directory and
writes a project extension which selects its store, this checkout and a startup `PI_LIFE`.
Start two Pi threads on that directory with ordinary prompts. Once each has run, remove the
`PI_LIFE` assignment from the generated extension when checking inherited attachment or detach
across process restarts. The installed BB Pi bridge currently
leaves a handled slash-command submission active ([get-bb/bb#3792](https://github.com/get-bb/bb/issues/3792)). For disposable trial
threads, stop that pending submission before sending an ordinary prompt; direct pi RPC
does not need this workaround. Agent-authored `bb thread tell` prefixes its message, so
use the user composer for slash commands.

Try holding different work, overlapping runs, catching up after one finishes, reading an
unfinished sibling, switching model, resume/fork and detach. To observe catch_up independently
of long-run view advancement, raise tailBytes first in the generated `.pi/settings.json`;
restore 800 for the long-run trial. A few bash calls with output force a boundary change.

## Named-agent first use

```sh
bun scripts/life-playground.ts prepare-agent
bun scripts/life-playground.ts start <root> one --model agent/<fixture>
bun scripts/life-playground.ts start <root> two --no-life-env --model anthropic/claude-haiku-4-5
```

`<root>` is the returned temporary directory; `<fixture>` is the returned name without its
leading `/`. The first command creates one `agents/<fixture>/SOUL.md` and one private
`skills/fixture-signal/SKILL.md`. Only this workspace registers that directory. Its store is
`<root>/store`; global notes remain disabled (`notes.enabled: false`, notes omitted from
`memory.systems`). The fixture routes to credentialed `anthropic/claude-haiku-4-5:off`, using
installed pi authentication, independently of the Concept Engineering trial's model.
The generated extension loads this checkout's agents, stances, context and system-prompt,
with agents before prompt rendering. The ordinary life fixture above is unchanged.

In **one**, ask: “What is your soul name and fixture signal? List private skills with their
exact descriptions, and whether note is available.” Expect the fixture name, **copper
telescope**, **fixture-signal**, and `note`. Ask it to read its private skill for the skill's
**violet lantern** signal. While one is busy (ask it to run `sleep 8`), its session is in the
life's Working present; an attached sibling sees it on its next run.

In **two**, the current prompt has neither soul nor private skill nor `note`. Then:

```text
/life /<fixture>
```

The next run has the same soul, skill and notes as one. Ask one to edit the private skill's
description and commit that file; ask two for the exact description on its next run without
reading files. It sees the edit without restart. Select another ordinary model while attached:
identity stays. `/memory -notes` removes `note`; `/life off` removes the soul and private skill.
The conversation still contains earlier claims of identity, so model self-reports after detach
can be stale: inspect current system sections/tool deltas in JSON/RPC output when checking this.

After two has messages and is off, selecting `agent/<fixture>` changes its model only; the
notice points to `/life /<fixture>` for intentional attachment. A fresh session selecting that
model attaches automatically. An ordinary stance worker starts independently:

```sh
bun scripts/life-playground.ts start <root> worker --no-life-env --model stance/auto-routine
```

It has no agent soul, private skill or `note`. `--no-life-env` clears the launcher's life
override; selecting an agent model in a fresh session still attaches by model.

Exit one, then resume it with `start <root> one --no-life-env`; the launcher continues that
slot and inherits attachment. Fork using the persisted file in `<root>/sessions/one/`:

```sh
bun scripts/life-playground.ts start <root> forked --no-life-env --fork <session-file>
```

The fork inherits the agent even on an ordinary model. Resuming an explicitly detached slot
keeps it off.

### BB startup

Use `prepare-agent-bb` for a new BB encounter. It trusts only that disposable directory;
there is no startup `PI_LIFE` override in this variant, so identity must come from the model
BB selects after pi starts. With the existing project's ID and the returned fixture:

```sh
bb thread spawn --project <project-id> --environment <root> --provider pi \
  --model agent/<fixture> --title 'Disposable named-agent first use' \
  --prompt 'State your soul name and fixture signal, list private skills and whether note is available. Do not call tools.' --json
bb thread show <thread-id> --json
bb provider models pi --environment <environment-id-from-show> --json
```

Expect `<fixture> (agent)`, ID `agent/<fixture>`, in the environment's model catalog, and the
same soul/signal/skill/notes in the reply. Use that exact model ID for automation selection.
A fixture registered only in project settings appears in that environment's catalog, rather
than the global catalog. For slash commands use the user composer and the stop-pending-submission
workaround described above. Finish with `bb thread stop <thread-id>` and
`bb thread archive <thread-id>`. The [recorded terminal and BB encounter](../../../docs/attachments/named-agent-first-use-in-terminal-and-bb/index.md)
includes prompt/tool observations and resume/fork.

## Cleanup

Stop trial threads/processes afterwards. Remove only the generated workspace when finished.
For a bb setup, clear its saved trust with:

```sh
bun scripts/life-playground.ts untrust <root-from-prepare-bb>
```
