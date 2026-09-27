# dsh overlay

This is an independent Bun package, not a workspace. It pins the npm dsh
0.1.7-rc.2 release candidate; the source clone and a cached `bunx dsh` are not
used. Node 24 runs dsh; Bun installs and bundles the local plugins.

From the repository root:

```sh
bun run setup                    # existing shared lib/ dependencies
bun run --cwd dsh setup           # pinned dsh dependencies + plugin build
export PATH="$PWD/dsh/node_modules/.bin:$PATH"
export DSH_HOME="$PWD/dsh/.local/home"
dsh web --patch "$PWD/dsh/cordis.yml" --no-open --host 127.0.0.1 --port 0
```

The isolated `DSH_HOME` avoids inherited profiles, credentials and selected
presets. The server prints a local login URL; keep its token private. This
spike requires anonymous-local Web, not Cloud. No provider credential is needed
to start Web or dispatch a tool program from a host plugin. An interactive
model conversation additionally needs a provider configured in dsh settings.

`hashline` is the default and only enabled preset. Its callable tools are
`read`, `write`, `edit`; PTC exposes `run_code`. Stock filesystem tools and
`fs-observation-policy` are absent. This deliberately small preset does not
include shell, search, delegation, or the other later port capabilities.

## First program

Given `example.txt` containing `alpha\nbeta\n`, invoke `run_code` with
`description: "Uppercase beta using its read anchor"` and this `code`:

```ts
const rows = await tools.read({ path: "example.txt" });
const row = rows.find(r => r.text === "beta");
if (!row) throw new Error("beta not found");
console.log(await tools.edit({ edits: "=" + row.hash + "\n" + row.text.toUpperCase() }));
console.log(await tools.read({ path: "example.txt" }));
```

`read` returns `{n, hash, text}[]`, not rendered content blocks. `hash` is the
shared ledger's anchor identity, not a line number. Changed lines retire their
anchors; unchanged lines retain theirs. `edit` uses the same hunk parser,
staleness reconciliation and mutation queue as `ab edit`. `write` creates new
files exclusively; existing files must be read and edited. There is no separate
hashline write implementation in `lib/outline-read` to wrap.

Ledgers are isolated per live agent and survive PTC cells, not agent restart or
plugin replacement. Reread after either. This is local trusted-host filesystem
access, not a replacement for dsh's sandboxed fs provider.

## Loading and development

`dsh/hashline/index.ts` imports shared `lib/outline-read` source relatively.
`bun run --cwd dsh build` bundles that source into `dsh/dist/hashline.js`, leaving
package imports external. `@deepseek-ai/*` resolves from `dsh/node_modules`;
the shared edit module still imports the root pi package. No clone symlinks or
ambient `NODE_PATH` are used.

The overlay loads the built plugin at top level. Relative plugin names nested
inside a preset failed in this release; see
[the recorded friction](../docs/issues/dsh-preset-relative-plugin-loading.md).
Typed `defineTool.output.schema` supplies both PTC return types and validation;
`output.render` is only the native presentation. `run_code` itself requires a
`description` as well as `code`.

Rebuild and restart after code changes. dsh watches profile configuration by
default, but its module HMR roots are opt-in; source edits are not automatically
rebuilt. HMR was not exercised in the spike.
