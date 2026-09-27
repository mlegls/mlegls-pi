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

## Skim and recall

Successful `run_code` results over 4 KiB are skimmed before entering context. When
filtering completes but cannot fit a result, its full text is replaced with a
spill-backed `ing-…` locator. Skim or spill failures keep the original result.
Programs can also call `await tools.skim({ text, focus })`. Use
`await tools.pull({ id })` in a later program to recover a retained page verbatim.
The local spill backend stores originals outside context. Locator lookup is scoped to the live agent and does not survive a restart.

## Live headless turn

`provider.deepseek.yml` selects `deepseek-official` / `deepseek-flash` and resolves
`DEEPSEEK_API_KEY` from the launching environment; it stores no key. It disables
the two optional request-extension contributors that failed preparation together
on the pinned dsh release; see
[`dsh-web-deepseek-extension-preparation-fails.md`](../docs/issues/dsh-web-deepseek-extension-preparation-fails.md).

From the repository root, after `bun run --cwd dsh setup`:

```sh
: "${DEEPSEEK_API_KEY:?export the key in the launching environment}"
export PATH="$PWD/dsh/node_modules/.bin:$PATH"
export DSH_HOME="$PWD/dsh/.local/headless-home"
export DSH_TOOLS_MODE=ptc
install -d -m 700 "$DSH_HOME"
dsh --profile headless \
  --patch "$PWD/dsh/cordis.skim-headless.yml" \
  --patch "$PWD/dsh/provider.deepseek.yml" \
  "Use run_code to print DSH_LIVE_MODEL_OK, then report it."
```

A real skim additionally uses the configured ingress decision service and local
LLMLingua cache; failures preserve the original `run_code` result.

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

First-use verification for this ticket: [dsh skim/run_code encounter](../docs/attachments/dsh-skim-run-code-results/index.md).

## Shared board

`dsh/board/index.ts` uses the shared `lib/board` append-only store, so pi and dsh
sessions see the same messages. It registers `board_send`, `board_read`,
`board_list`, `board_subscribe`, and `board_ack`. Each DSH session subscribes to its own
`mail/<session-suffix>` topic, derived from that DSH Session ID, plus worktree/project
scopes derived from its own `cwd`. Lifecycle reports go to the same session mailbox.
Do not pass pi's process-level identity variables to DSH Web; one Web host can own many
DSH sessions. The live-verification setup is in `board/verification/README.md`.
Quiet subscriptions wait for the next agent step rather than queueing a wake.

A full `board_read` acknowledges the returned messages and retracts any matching
queued wake; `fields: "meta"` is observational, and `board_ack` is the explicit
acknowledgment path. Subscriptions, cursor, pending messages, and seen IDs live in
ignorable session events. Polling and inbox mutations await `ctx.sessions.flush()`
before treating delivery as durable.

The focused host contract test is `bun test board/index.test.ts` from `dsh/`.

The pinned `dsh-session` 0.1.7-rc.2 release drops `{ ignorable: true }` from
`Session.append()` options; `patches/@deepseek-ai%2Fdsh-session@0.1.7-rc.2.patch`
(Bun `patchedDependencies`) restores it. Keep that entry and its lock metadata
when combining dsh package changes.
