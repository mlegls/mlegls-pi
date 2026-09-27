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

For a real DeepSeek model turn, add `--patch "$PWD/dsh/provider.deepseek.yml"`
to that command and set `DSH_TOOLS_MODE=ptc`. The committed overlay reads
`DEEPSEEK_API_KEY` from the launch environment (never put its value in the file);
it selects `deepseek-official` / `deepseek-flash` and disables the two optional
request-extension plugins implicated in the local Web preparation failure. This
overlay is for local verification, not the anonymous no-provider setup above.

The isolated `DSH_HOME` avoids inherited profiles, credentials and selected
presets. Keep it under `dsh/`: dsh resolves package-named plugins such as
`@deepseek-ai/dsh-tool-session-query` from the profile directory in `DSH_HOME`,
so a home outside this package fails with `failed to import` for them.
The server prints a local login URL; keep its token private. This
spike requires anonymous-local Web, not Cloud. No provider credential is needed
to start Web or dispatch a tool program from a host plugin. An interactive
model conversation additionally needs a provider configured in dsh settings.

`hashline` is the default and only enabled preset. PTC exposes `run_code`,
with `read`, `write`, `edit`, `grep`, `glob`, `transform`, `shell`, `scratch_get`,
`scratch_put`, `scratch_delete`, `scratch_list` and the stock session-query tools
inside programs. Stock filesystem mutation tools and `fs-observation-policy`
remain absent. The stock `grep`/`glob` are dsh's ripgrep-backed search bindings.
Automatic context compaction uses [autobiographical memory](memory/README.md).

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

## Scratch state

`scratch_get`, `scratch_put`, `scratch_delete`, and `scratch_list` are host tools in
PTC's generated SDK. Values are lossless JSON, keyed within the live Session; use
string handle ids for objects owned by other host services. Scratch state lives in
host memory only, does not survive session reload or restart, and forks start empty.
Plugin replacement also discards it; reread after replacement. This is separate from
Scratch state is separate from local trusted-host filesystem access; it is not a
replacement for dsh's sandboxed fs provider.

## Grep, transform, test in one program

Given two TypeScript files containing `foo(1)` and `foo(2)`, run this with
`description: "Rewrite foo calls and run tests"`:

```ts
const hits = await tools.grep({ pattern: "foo", path: "src" });
const files = [...new Set(hits.matches.map(m => m.path))];
console.log(await tools.transform({ files, pattern: "foo($A)", rewrite: "bar($A)", language: "ts" }));
const quote = v => "'" + String(v).replaceAll("'", "'\\''") + "'";
const $ = (parts, ...values) => tools.shell({
  command: parts.reduce((s, part, i) => s + (i ? quote(values[i - 1]) : "") + part, ""),
});
const test = await $`bun test lib/outline-read | cat`;
console.log(test);
if (test.code !== 0 || test.truncated || test.timedOut) throw new Error("tests failed or incomplete");
```

`$` is a local template wrapper over the `shell` JSON binding (the PTC SDK
cannot transport functions). Quoted interpolations are single shell arguments;
literal template text remains bash syntax, including pipes. `shell` uses dsh's
configured shell executor, managed environment, session workspace and standing
sandbox policy. It does not request approval to escalate: no background jobs or
sandbox-permission override. It reports stdout/stderr separately, exit code,
truncation and timeout; check the latter two before trusting a successful code.

`transform` runs the installed ast-grep CLI against each named file in dsh's
shell sandbox using stdin (never `-U`), applies replacement byte offsets to
in-memory copies, then submits one structured multi-file hashline edit batch.
Anchors share the same per-agent ledger as `read` and `edit`; the combined diff
comes back in one tool result. JSON tool arguments cannot contain a callback:
for a custom line function, compute hunks from `tools.read` inside the program
and submit them to `tools.edit`. Transform rejects overlapping matches,
truncated search output, duplicate paths, and trailing-newline changes.
Edits are not transactionally rolled back across files, just like `edit`.
The host-side hashline edit is trusted local filesystem access, not the dsh
shell sandbox. Every nested binding call is a `tool/ptc-dispatch` entry.

## Loading and development
`dsh/hashline/index.ts` imports shared `lib/outline-read` source relatively.
`bun run --cwd dsh build` bundles that source into `dsh/dist/hashline.js`
and builds `dsh/dist/transform.js`, leaving package imports external.
`@deepseek-ai/*` resolves from `dsh/node_modules`; the shared edit module
still imports the root pi package. No clone symlinks or ambient `NODE_PATH`
are used.

The overlay loads the built plugin at top level. Relative plugin names nested
inside a preset failed in this release; see
[the recorded friction](../docs/issues/dsh-preset-relative-plugin-loading.md).
Typed `defineTool.output.schema` supplies both PTC return types and validation;
`output.render` is only the native presentation. `run_code` itself requires a
`description` as well as `code`.

Rebuild and restart after code changes. dsh watches profile configuration by
default, but its module HMR roots are opt-in; source edits are not automatically
rebuilt. HMR was not exercised in the spike.
