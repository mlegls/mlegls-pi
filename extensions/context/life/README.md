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
still selects other systems. Notes compose with life when enabled through
`memory.schemas.notes.enabled`.

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

Stop trial threads/processes afterwards. Remove only the generated workspace when finished.
For a bb setup, clear its saved trust with:

```sh
bun scripts/life-playground.ts untrust <root-from-prepare-bb>
```
