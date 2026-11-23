# Life

Attach with `/life <name>`; `/life off` detaches; `/life` shows current attachment. A bare name is scoped to the git repository (shared across worktrees); `/life /<name>` is machine-wide. Resume and fork inherit attachment (including explicit `off`), and changing models preserves it.

`PI_LIFE=<name> pi` attaches at startup and strips `PI_LIFE` from its environment so spawned children default to OM unless explicitly given a life:

```sh
PI_LIFE=/concept-engineering pi
PI_LIFE=/concept-engineering pi --print 'Read the issue and report what is missing.'
```

Attached sessions use life for compaction and context (otherwise OM is default; `/memory` selects others). Notes compose with life unless `memory.schemas.notes.enabled` is false.

Each run sees a fixed shared view, the present, and its current work whole; completed runs elsewhere enter the next run's view. Tools while attached:

- `hold({text})`: one-line summary of what you hold here (empty string clears).
- `catch_up({})`: committed leaf lines since the current view, with places.
- `catch_up({thread})`: your unfinished run in that BB thread, whole.
- `zoom({id,n})`: expand a summary (`n: 1` returns copied message and source).
- `date({id})`: source timestamp (reaches newer committed positions too).

Settings live under `memory.schemas.life`: `fanout`, `view`, `compactorView`, `concurrency`, `retries`, `waitSeconds`, `tailBytes`, `model` (defaults to turn's model), `systemPrompt`, `cut`, `scorer`. Long runs commit a complete prefix before advancing their boundary while keeping the user's message whole.

## First use

From this checkout (uses installed Anthropic creds, Haiku 4.5, `tailBytes: 800`, temporary store):

```sh
bun scripts/life-playground.ts prepare
bun scripts/life-playground.ts start <root> one
bun scripts/life-playground.ts start <root> two
```

Pass `--no-life-env` to omit startup `PI_LIFE` (new slots start unattached; resumed slots keep persisted attachment), and `--no-life-env --fork <session-file>` to fork. Raise `tailBytes` in the generated `.pi/settings.json` to test `catch_up` without long-run boundary moves; restore `800` to trigger compaction via a few verbose bash calls.

For BB, run `prepare-bb` and open two Pi threads on the generated directory (remove `PI_LIFE` from the generated project extension after the first run to test inherited attach/detach). Note: BB's Pi bridge currently leaves handled slash commands pending ([get-bb/bb#3792](https://github.com/get-bb/bb/issues/3792))—send slash commands from the user composer and stop the pending submission before the next prompt.

## Named-agent first use

```sh
bun scripts/life-playground.ts prepare-agent
bun scripts/life-playground.ts start <root> one --model agent/<fixture>
bun scripts/life-playground.ts start <root> two --no-life-env --model anthropic/claude-haiku-4-5
```

Creates `agents/<fixture>/SOUL.md` (signal: **copper telescope**) and private `skills/fixture-signal/SKILL.md` (signal: **violet lantern**), routed to `anthropic/claude-haiku-4-5:off` with global notes off.

Check:
- **one** sees soul, private skill, and `note`; while busy (`sleep 8`), attached siblings see it in Working present.
- **two** starts without soul/skill/`note`; `/life /<fixture>` attaches it, sees edits to the private skill on the next run without restart, keeps identity across model switches, drops `note` on `/memory -notes`, and drops soul/skill on `/life off` (verify detach from JSON/RPC system sections rather than model self-report). Selecting `agent/<fixture>` after messages already exist only changes model and prompts `/life /<fixture>`.
- Ordinary stance workers (`start <root> worker --no-life-env --model stance/auto-routine`) have no agent soul, private skill, or `note`.
- Resuming (`start <root> one --no-life-env`) and forking (`--fork <session-file>`) preserve attachment (including explicit `off`).

### BB startup

Use `prepare-agent-bb` (no startup `PI_LIFE`, so identity comes from BB's model selection):

```sh
bb thread spawn --project <project-id> --environment <root> --provider pi \
  --model agent/<fixture> --title 'Disposable named-agent first use' \
  --prompt 'State your soul name and fixture signal, list private skills and whether note is available. Do not call tools.' --json
bb thread show <thread-id> --json
bb provider models pi --environment <environment-id-from-show> --json
```

Expect `agent/<fixture>` in the environment's model catalog and the fixture signals in the reply. Stop and archive the thread afterwards ([recorded encounter](../../../docs/attachments/named-agent-first-use-in-terminal-and-bb/index.md)).

## Cleanup

Stop trial processes/threads, delete the generated workspace, and for BB setups clear trust:

```sh
bun scripts/life-playground.ts untrust <root>
```
