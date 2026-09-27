# Hashline PTC first use — supervised verification

Fresh supervised encounter on `b12888e` with the worker-owned checkout and its
isolated dsh home. The required surface is anonymous-local dsh Web with PTC and
the hashline preset. A model turn used `DEEPSEEK_API_KEY`; its value is not
recorded. No Cloud selectors or the user's real `~/.dsh` provider settings/profile
were reused. Since this verification drove the rendered Web UI, the packet
includes screenshots for visual review.

## Setup and readiness

`bun run setup` and `bun run --cwd dsh setup` completed, building the pinned
`@deepseek-ai/dsh` 0.1.7-rc.2 plugin. Target: this worker-owned checkout
`dsh-hashline-tools-spike-verify`, isolated `dsh/.local/home`, loopback Web on
OS-selected port 63822. The anonymous local login completed using the generated
Web URL. The isolated home initially contained a default workspace pointing at
`/Users/mlegls/Documents/deepseek-harness/default-workspace`; before sending a
prompt, I changed only the isolated workspace record to this checkout. No
sessions were created in the external workspace. The fixture was seeded as
`alpha\nbeta\n`.

The launch used the committed Cordis overlay plus an ignored local provider
patch: `llm-deepseek-api-key` reads `DEEPSEEK_API_KEY`, and
`agent-default-model` selects `deepseek-official` / `deepseek-flash`. Entry point:

```sh
PATH="$PWD/dsh/node_modules/.bin:$PATH" \
DSH_HOME="$PWD/dsh/.local/home" DSH_TOOLS_MODE=ptc \
DEEPSEEK_API_KEY="$DEEPSEEK_API_KEY" \
  dsh web --patch "$PWD/dsh/cordis.yml" --patch "$PWD/dsh/.local/provider.yml" \
    --no-open --host 127.0.0.1 --port 0
```

Two setup attempts failed before tools ran: the initial default `deepseek` route
had no adapter; after selecting `deepseek-official`, request-extension preparation
failed. The successful run used a local-only overlay disabling the optional
`session-log-deepseek` and `plugin-package-inventory-deepseek` contributors. The
cause of their preparation failure was not isolated; this is a workaround, not a
claim that those plugins work. No other task behavior was changed.

## Encounter: read, compute, edit, reread

In the Hashline Web session, I asked the model to read
`dsh/.local/example.txt`, find `beta`, compute an edit from its returned hash
anchor to replace it with `gamma`, apply it, and reread, using only hashline
tools. The model completed in one `run_code` program. The trajectory shows:

- `read` returned structured rows `{n, hash, text}`: `alpha` at anchor `g7mm`,
  `beta` at `gkvq`.
- The same program computed `=gkvq\ngamma`, invoked `edit`, and reread.
- The reread kept alpha's anchor and returned gamma with a changed anchor (`gphh`).
- The final file at `dsh/.local/example.txt` was exactly `alpha\ngamma\n`.

The Web trajectory's `TOOL run_code` row and nested `SUBTOOL read`, `SUBTOOL edit`,
and `SUBTOOL read` rows are visible in [02-trajectory.png](02-trajectory.png).
The completed chat and result are in [01-success.png](01-success.png). These are
live interaction states, not seeded output or a mock. No code repair was needed,
and no new replay assertion was warranted on first use. The earlier
[implementation first-use log](first-use.log) remains self-check context only.

## Visual evidence

- [01-success.png](01-success.png) — completed Web turn, computed anchor hunk, and
  structured reread result.
- [02-trajectory.png](02-trajectory.png) — actual `run_code` and nested hashline
  tool dispatch sequence.
- [03-direct-tools.png](03-direct-tools.png) — the same session's Initial System
  Prompt → Tools tab: `run_code` is the only directly callable tool.
- [04-sdk-bindings.png](04-sdk-bindings.png) — the same prompt's PTC SDK bindings:
  `ToolName` is exactly `edit`, `read`, `write`, and `read` returns
  `{n, hash, text}[]`.
- [05-preset-menu.png](05-preset-menu.png) — fresh launch after the review repair:
  Hashline is the only preset and now describes itself.

The encounter's browser/host setup friction is tracked at
[dsh-web-deepseek-extension-preparation-fails](../../issues/dsh-web-deepseek-extension-preparation-fails.md).
The earlier preset-loading and environment typecheck issues remain linked from
the ticket.

## Visual review

Reviewed `01`/`02` and the persisted session log. 03–05 were collected by the
reviewer from a copy of the collector's isolated dsh home, launched with the same
overlay and provider patch. 03 and 04 show the recorded session from the live
turn, restored, not a new model turn. 05 is a fresh launch after the repair; no
new model turn was sent.

| Claim | Outcome | Evidence |
| --- | --- | --- |
| `dsh web --patch dsh/cordis.yml` starts with the hashline tools and the stock fs tools absent | held | 03: `run_code` is the only direct tool. 04: the SDK declares only `edit`/`read`/`write`. The request header in the session log lists only `run_code`. 05: stock presets are gone from the picker. |
| `read` returns structured lines usable without the model copying anchors | held | 04 `ToolOutputMap.read`. 02: the run_code result prints `{"n":2,"hash":"gkvq","text":"beta"}`. |
| One `run_code` program reads, computes an edit from the returned anchors and applies it | held | 02: one TOOL `run_code` with SUBTOOL `read`, `edit`, `read`. The logged program builds ``=${target.hash}\n${newText}`` from the `read` result. The model had seen no anchors before that call, so it could not have copied them. 01: reread `gamma` has anchor `gphh`. |
| Layout settled and recorded in dsh-port | held (documentary) | `docs/issues/dsh-port.md`, decision of 2026-09-27: npm 0.1.7-rc.2, independent package (not a Bun workspace), Bun bundles `../../lib/` into `dsh/dist/`. |
| Cordis/PTC friction reported | held (documentary) | [dsh-preset-relative-plugin-loading](../../issues/dsh-preset-relative-plugin-loading.md) and [dsh-web-deepseek-extension-preparation-fails](../../issues/dsh-web-deepseek-extension-preparation-fails.md). HMR was not exercised (see below). |

Repair: the preset picker showed "No description." under the only preset (visible
before the fix; not committed). `dsh/cordis.yml` now gives `preset-hashline` a
`description`, and I re-drove it with a fresh launch (05). There were no
blocking findings.

Nonblocking: the trajectory shows SUBTOOL `read` results in the anchored text
rendering (`1 g7mm│alpha`), while the program receives JSON rows. The sandbox
still reports the workspace as the collector's checkout, because the home was
copied: a session log's identity is bound to its cwd path, so the session cannot
be relocated into another checkout.

## Prior implementation evidence

See [first-use.log](first-use.log) and the implementation packet's test notes
for the implementer's self-check. They are context, not claims observed afresh
here.

This is the implementer's self-check at `b12888e`, starting from
`b660fa565010060df3c65951a0c6713a369ecabc`; it predates this supervised Web
encounter and is retained as context only.

## Setup

Required: local dsh Web, PTC, hashline tools instead of stock fs. No Cloud target
or provider-authenticated model turn is required for this tool-dispatch story.

Prepared: worker-owned checkout `dsh-hashline-tools-spike`, independent
`dsh/node_modules`, npm dsh/tools 0.1.7-rc.2, Cordis 4.0.4, Node 24.21.0,
Bun 1.4.2. `bun run --cwd dsh setup` completed. The subprocess package's
required spawn-helper postinstall is trusted explicitly in `dsh/package.json`.
The shared root/lib dependencies were already installed in this worktree.

`DSH_HOME=$PWD/dsh/.local/home` is a fresh checkout-local home, not an inherited
user profile. Web uses local anonymous identity and its generated browser login
token. No Cloud selectors or credentials were reused. The trial seeded only
`dsh/.local/example.txt` with `alpha\nbeta\n`.

Entry point from repository root:

```sh
export PATH="$PWD/dsh/node_modules/.bin:$PATH"
DSH_HOME="$PWD/dsh/.local/home" dsh web --patch "$PWD/dsh/cordis.yml" \
  --no-open --host 127.0.0.1 --port 0
```

The server started on loopback with an OS-selected port. Its login token is
intentionally absent from this packet. See `dsh/README.md` for clean setup.

## Trial

A temporary, ignored diagnostic overlay mounted a host plugin in the actual Web
process. It created a real agent through `ctx.agents.create`, with the fixture
directory as session cwd, and mounted the `hashline` preset through
`ctx.agentPresets.mount` in `setup`. It inspected
`ctx.tools.schemas(scopeOf(agent.ctx))` and dispatched through
`ctx.tools.execute({name: 'run_code', arguments: {description, code}, agent,
signal, callId})`. It disposed its agent after the call. No fake PTC runtime,
model response or alternate tool implementation was used.

The program was:

```ts
const rows = await tools.read({path: 'example.txt'});
const row = rows.find(r => r.text === 'beta');
console.log(await tools.edit({edits: '=' + row.hash + '\n' + row.text.toUpperCase()}));
console.log(await tools.read({path: 'example.txt'}));
```

Observed, in [first-use.log](first-use.log):

- Visible registry: exactly `read`, `edit`, `write`, `run_code`. The first three
  are the overlay's tools; no stock read_image or string-replace tool was present.
- `run_code` succeeded (`isError: false`). Its Node sandbox reported
  `workspace-write`, `denied: false`, `enforcement: full`.
- The program consumed typed row objects, computed the replacement header from
  `row.hash`, and changed only `beta` to `BETA`.
- The next read returned `{n, hash, text}` objects with a new BETA anchor and an
  unchanged alpha anchor. An independent host read observed `alpha\nBETA\n`.

The sandbox report describes the Node PTC process, not the trusted host-side
hashline file operations. These tools directly reuse local lib code and do not
implement dsh's fs-provider sandbox boundary.

## Existing checks

- `bun-axi test lib/outline-read`: 55 passed, 6 files.
- Focused TypeScript check of `dsh/hashline/index.ts` with root compiler options:
  passed (strict, noEmit, skipLibCheck, bundler resolution, esnext, bun-types).
- `git diff --check`: passed.
- Root `bunx tsc --noEmit`: 53 errors, all in unchanged Obsidian tracker files;
  [environment issue](../../issues/root-typecheck-obsidian-environment.md).
- No new permanent acceptance tests. HMR and model-authenticated conversation
  were not exercised. Source HMR requires an explicit watch/build policy;
  [loading friction](../../issues/dsh-preset-relative-plugin-loading.md) records
  the preset-relative import failure and top-level loading workaround.
- Tracker semantic lint completed with advisory `completed`, `superseded`, and
  `unowned` flags. The ticket remains open for its supervisor's fresh verifier;
  the layout decision resolves its choice rather than superseding the work,
  and both discovered frictions have linked owners.
- Tracker structural check reports four pre-existing done-dependency links in
  [supervision-phase-loop](../../issues/supervision-phase-loop.md) and
  [supervise-as-exception-handler](../../issues/supervise-as-exception-handler.md).
  No unrelated tracker cleanup was made.

All Web processes started for this trial were stopped. Dependencies, build output,
the isolated local home and edited fixture remain prepared in the worker checkout.

## Cost

The runtime addition is one 83-line plugin and a 30-line overlay. Shared `lib/`
implementations are unchanged. Dependency cost is a separate dsh installation
(521 checked installs / 588 lock packages), with a 1,207-line Bun lockfile; no
new permanent test suite or launcher was added.
