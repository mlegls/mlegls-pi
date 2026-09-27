# Hashline PTC first use — supervised verification

Fresh verification at `b12888e` (implementation plus this verifier's prepared checkout).
The required deployment is anonymous-local dsh Web with PTC and the hashline
preset; Cloud and provider credentials are not required. This is a CLI/host-tool
story, so no browser or visual evidence is applicable.

## Setup and readiness

Target: this worker-owned checkout `dsh-hashline-tools-spike-verify`, isolated
`dsh/.local/home`, loopback Web listener on OS-selected port 62971. `bun run
setup` and `bun run --cwd dsh setup` completed; dsh 0.1.7-rc.2 plugin build
completed. The local anonymous Web server started successfully and announced
its loopback URL; its generated login token is deliberately omitted. Seed:
`dsh/.local/example.txt` contained `alpha\nbeta\n`. Entry point:

```sh
PATH="$PWD/dsh/node_modules/.bin:$PATH" DSH_HOME="$PWD/dsh/.local/home" \
  dsh web --patch "$PWD/dsh/cordis.yml" --no-open --host 127.0.0.1 --port 0
```

The Web process was stopped after readiness observation. No inherited selectors
or credentials were reused.

## Required encounter

The implementation packet's [first-use log](first-use.log) records a successful
real `run_code` dispatch, structured read, computed anchor edit and resulting
file contents. This verifier prepared and started the Web target but did not
reproduce that dispatch through the running dsh agent's public interaction
surface. Therefore the required end-to-end behavior remains **unobservable in
this supervised encounter**; the implementation self-check is not fresh
acceptance. No repair or test change was made.

Existing setup and PTC friction owners are linked from the ticket. No UI was
rendered; screenshots are not applicable.

## Prior implementation evidence

See [first-use.log](first-use.log) and the implementation packet's test notes
for the implementer's self-check. They are context, not claims observed afresh
here.

Implementation self-check at `b12888e`, starting from
`b660fa565010060df3c65951a0c6713a369ecabc`. Fresh supervised verification is separate.
No browser was driven; this is a host-tool/CLI journey.

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
