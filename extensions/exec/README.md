# exec

One tool for TypeScript cells with fresh local scope and persistent explicit state.
Replaces the advertised file/shell,
Exa, terminal, and desktop-control tools with composable functions.
Requires Node 22.13+ and ripgrep (`rg` on PATH or pi's installed copy).

Reload pi (`/reload`) to enable it. Use `/exec-reset` to stop the kernel and
its subprocesses and clear retained state without discarding file anchors.

## Host libraries

Host integrations live in `lib/*/host.ts` alongside their callable capabilities.
Each is an independent Pi extension explicitly listed in `package.json` under
`pi.extensions`, with a default factory export:

```ts
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function install(host: ExtensionAPI) {
  host.on("before_agent_start", (event) => ({
    systemPrompt: event.systemPrompt + "\nYour local policy.",
  }));
  host.registerCommand("example", {
    description: "A host command",
    handler: async (_args, ctx) => { ctx.ui.notify("Hello"); },
  });
}
```

Pi awaits each factory before session startup and provider discovery completes.
Its per-extension load boundary discards a failed factory’s registrations, removes
its event-bus subscriptions, and rejects further calls through its captured API.
Other extensions remain usable; Pi reports load failures. This isolates Pi
registrations, not arbitrary filesystem, process, or import-time side effects.
Start session resources in `session_start` and clean them up in
`session_shutdown`; Pi owns event-bus subscription cleanup.

Add new host entrypoints to `package.json`; exec does not discover or install them.
Use `/reload` (or a new Pi process) after editing host code or to retry a failed
load. `/exec-reset` only reloads kernel code. `lib/<name>.ts` and project
`.pi/exec/*.ts` remain cell libraries; project overrides do not install host hooks.
Loading only `extensions/exec/index.ts` with `-e` does not load the host extensions.

Featherless, fence, system-prompt, and workspace also remain independent Pi
extensions. The former standalone adapters are [archived](../disabled/README.md);
do not enable them alongside the corresponding manifest entrypoint. Exa and Board
standalone tools are archive-only. Workspace owns its approval tool and command.

## Asynchronous results

Cells never time out. Each exec call is cell `cN` (numbered per session branch)
and each `show`/`console.log` call in it is output handle `cN.k`. The tool
result returns when the cell and all its shows finish, or after a 10s yield
(`PI_EXEC_YIELD_MS` overrides it; the clock starts once the kernel receives the
cell) with whatever has been shown, labeled by handle, plus the pending handles:

```text
[c7.1]
now
c7 running; pending c7.2. Later output arrives by handle at the next tool result, or wakes you if idle. …
```

Each show renders when its own values resolve, independently of earlier calls.
Output that settles after the yield is queued and delivered once: with the next
exec result, or, when the agent settles, as an `exec-output` follow-up that
starts a turn. A finished cell adds a passive `done` under `[c7]` that rides along but
never wakes the agent; a late error always does. Not calling `show` means the
result is not needed.

Late output is judged twice. Relevance is scored against the request that
started the work (the conversation and code when the cell ran), so a long task
the conversation has since moved on from still counts as asked for. Novelty is
scored at delivery against the conversation now: output it has already accounted
for (observed another way, acted on, or superseded) collapses to its handle and
first line and does not wake the agent. The threshold is P(accounted for) ≥ 0.8;
errors and unavailable judgments deliver in full. `show.pull("c7.2")` (or
`"c7"` for the whole cell) re-shows any handle's output until the kernel resets.

The cell is only an ergonomic boundary: handles are addresses, so waiting on one
is the same from its own cell or a later one.

- `show.sync(...)` is `show` that holds this result past the yield until shown.
- `wait("c7", "c8.2")` holds this result until those handles settle (`c7` = the
  cell body and all its shows) and shows `settled: …`.
- A user message queued while a result is held yields it immediately.

Cells run concurrently in one kernel. A later cell may start while an earlier
one still writes `state`; `wait` on its handle before reading such state.
JavaScript is single-threaded, so a cell stuck in a synchronous loop still blocks
every other cell.

Interrupting (Esc) detaches running cells: their later output is delivered with
the next result but does not wake the agent. The host then pings the kernel;
only if it cannot answer within 1s is it reset (state cleared, shell process
group killed, host calls aborted). File anchors and host-owned terminals survive
resets; filesystem and external side effects are not rolled back.

## Pi presentation

Collapsed exec rows list the operations actually invoked with one line of arguments
and three result-preview lines per operation, clipped to terminal width:

```text
exec ✓ read · grep
✓ read  extensions/exec/runtime.cjs
  extensions/exec/runtime.cjs:
  1 abcd│const …
  … more preview lines
✓ grep  /OUTPUT_LIMIT/  runtime.cjs
  21 efgh│const OUTPUT_LIMIT = 16 * 1024;
```

At most eight operations appear collapsed; additional operations have an omission
count. These are previews of the bounded trace, not complete returned values.
Expand the row with pi's tool-expansion key to see calls in invocation order,
their arguments, bounded result previews, durations, and pending/error states.
Explicit `show` output has its own section; the original TypeScript follows.
Concurrent calls retain invocation order rather than completion order. A retained
job can still be pending when its cell ends; tracing does not wait for it. Traces
freeze at cell completion; a pending entry is historical, not a live task monitor.
Late output arrives by handle (see above). Previews are capped
at 64 operations and 4 KiB per field, within a 64 KiB trace. Source previews use
the same byte budget. Truncation is explicit and does not truncate retained values.
Source, shell, and terminal values share a trusted passive formatter between
trace previews and explicit display. Traces never call user render/content methods;
explicit show still can. Transformations on returned selections are not traced—
show their result or select their provenance-bearing rows explicitly.

The trace is presentation-only, stored in tool-result details in the session log.
It adds nothing to model-visible output and does not replace `show`. Arguments
and results can contain sensitive data even when not explicitly shown; traces are
not a credential-redaction mechanism. Image payloads are excluded from previews.

## TypeScript execution

Cells use Node’s TypeScript transform before evaluation in a fresh async function.
The child process preloads `tsx` for ordinary and transitive TypeScript imports,
including the kernel’s own source bootstrap. Parameter properties and other
syntax requiring emitted JavaScript therefore work in imported `.ts` files;
there is no custom module transformer. Use `await import(...)` in cells.
Neither path type-checks code. Imported modules are cached for the kernel’s
lifetime; reset starts a fresh process. Project import/tsconfig handling belongs
to `tsx`, not a separately maintained exec implementation.

## Module selection

All non-legacy modules are enabled by default. `board` and `wm` are disabled in every client, including explicit allowlists. Select a surface with CLI flags:

```sh
pi --tools exec --exec-modules fs,sh,exa
pi --exec-deny-modules ui,wm
pi --exec-modules '*' --exec-deny-modules term,ui
pi --exec-modules none
```

Both flags take comma-separated module names. `*` means all; `none` or an empty
string means none. The denylist wins, and unknown names produce an explicit
configuration error rather than silently enabling everything.

| Module | Functions |
| --- | --- |
| `fs` | `read`, `write`, `find`, `grep`, `edit`, `replace`, `loadSkill` (including image reads) |
| `sh` | `sh` |
| `exa` | `exa.*` |
| `board` | Disabled (legacy) |
| `wm` | Disabled (legacy) |
| `term` | `term.*` |
| `ui` | `ui.*` |

`fs` is a configuration group, not a new REPL namespace. Existing function names
are unchanged. `show`, `wait`, and `console` are available in both profiles. Disabled
module globals and API documentation are omitted; `host.call` also rejects
excluded namespaces. Selection survives kernel resets and session navigation.

Agent frontmatter supplies a stance, not a launch command. Use `route.prepare`
and `dispatch` to launch routed Pi workers. The auto-loaded `orca` library supplies native supervision and messaging; see [Orca](../../docs/orca.md). `agent` in a routed assignment names a stance.
Module selection limits the supplied API, **not** filesystem/process permissions: arbitrary
imports and enabled shell commands can still access underlying capabilities.
The full reference below describes all modules; each session advertises only its
selected surface.

### Reader profile

Use `pi --exec-profile reader` (or `PI_EXEC_PROFILE=reader` for host-managed
readers). Autoread selects this profile automatically. It exposes only
`read`, `find`, `grep`, source/selection helpers, `state`, `show`, `console`,
and `exa`. Module allow/deny flags can narrow it further, never widen it;
`--exec-deny-modules exa` disables web research.

No write/edit helpers, `loadSkill` shell expansion, shell, terminals,
UI, coordination, or automatic `lib/` and `.pi/exec/` modules are exposed or
loaded. Read skill files as reference without executing them. Internal
relevance filtering still works. The profile is API shaping, **not a security
sandbox**: imports and OS access remain unrestricted.

## Project modules

`lib/<name>.ts` is in the cell as `<name>`, except names already in the exec API
(`board`, `wm`, and the rest of the module table). A project file
`.pi/exec/<name>.ts` shadows the lib file with the same stem. A name that is not
in `lib/` is `project.<name>`. Upstreaming is moving the file to `lib/`.

A lib or project module that exports `attach(api)` is handed the cell API
(`read`, `edit`, ...) once at kernel start, so it can return anchored rows.

`code` is the program as a graph, for TypeScript projects with a tsconfig:
`code.index(root?)` gives definitions (`defs`, `def(name)`, each with `file`,
`line`–`endLine`, `signature`, `body`): top-level statements and the functions,
classes, members, and function-valued variables nested in them, named by dot
path. References between them are checker-resolved and owned by the innermost
definition: `callers`, `callees`, `tests`, `dead`, `impact` (transitive callers),
`similar` (shared callees or callers, by Jaccard), `around` (a fisheye: the body,
neighbors by signature, files beyond by count). Joins are plain TypeScript over
those arrays. Every call re-indexes incrementally, so the snapshot follows
edits. `await ix.rows(d)` is the definition's anchored rows for `edit`/`replace`.
Source in [outline-read/program.ts](../../lib/outline-read/program.ts).

`autoread.run(request, options?)` runs a read-only reader fork of this
session and returns its final briefing. Exec passes `PI_SESSION_FILE` to the
kernel; reload the extension once after installing this change. See
[autoread](../../docs/autoread.md) for retained-promise usage and options.

`/exec-reset` (or a new session) re-imports; a running kernel keeps the modules
it started with.


## Cell scope and retained state

Each call has fresh scope: ordinary `const`, `let`, `var`, and function
declarations do not persist. Their names can be redeclared in the next call. No extra block is needed:

```ts
const result = await sh.raw`git status --short`;
await show(result);
```

Retain values or promises explicitly in the mutable, null-prototype `state` object:

```ts
state.hits = await grep("TODO", "src");
```

In a later call:

```ts
await show(state.hits.context(3));
await show(Object.keys(state));
delete state.hits; // release a retained value
```

The kernel, imports, and asynchronous work persist. Local declarations do not.
State writes and other side effects survive a later error; calls are not
transactions and failed code must not be blindly replayed. Reset clears state.

## Foveated reading

Read with an intent, not just a search term:

~~~ts
await show(await read("src/example.ts"), { focus: "inspect cancellation before editing" });
await show(state.document, { focus: "understand the architecture" });
await show(state.document);             // infer attention from the session
await show.pull("ing-0123456789abcdef"); // exact skimmed/omitted original, no rescoring
await show.raw(state.result);           // no semantic transformation
~~~

Jev chooses 100/75/50/25/0% retention. A persistent local LLMLingua-2 worker
compresses prose at the middle levels; 25% is explicitly keyword cues, not assertions.
Focus supplements the conversation tail and current cell. Skims can lose qualifiers
and relationships: pull the original before relying on details. Code, tables and
anchored evidence use exact excerpts instead of token deletion. Headings and recovery
handles remain visible, and original retained values never change.

One-time local setup: `uv run --no-project --python 3.12 --script lib/skim-worker.py --setup`
from this package. Normal reads run offline and reuse the loaded model until reset.
Unavailable compression falls back to labeled source excerpts; see
[setup, limits and replay](../../docs/ingress.md).

A trailing object containing only a string `focus` field is reserved as options
when another value precedes it. Other variadic values—including trailing strings—
remain content. Use `show.raw` to display that object literally alongside other
values. `show.large` accepts the same focus option and raises the display cap.
Console aliases and notifications infer focus from context.

Raw/pull still obey byte/image caps. Loaded skills and images bypass filtering.
Missing credentials, scorer failure, or timeout keeps the original with a warning.
Rendering counts notice overhead in UTF-8 bytes and never expands a successful
filtered read. Under budget pressure peripheral skims yield before exact passages;
ordinary display truncation can still cut an oversized result.
[Policy, setup, and verification](../../docs/ingress.md).

## Reserved API names

Enabled API names, `state`, and `__exec` are reserved at cell top level.
Declaring one there is a syntax error before any code runs; assigning to one
fails at runtime. Nested scopes can shadow names without affecting other cells.
The frozen `__exec` registry exposes the enabled capabilities, also available
as non-writable `globalThis.__exec`. API wrappers and namespaces are frozen;
returned values and `state` contents are not. This is accident prevention,
not a security sandbox.

## Read, select, display

Each tool call has one parameter, `code`. Values saved in `state` survive calls.
Only `show(...)` / `console.log(...)` emit model-visible data. Raw process output
and interrupted-shell captures are bounded UI-only diagnostics in result details.
Await `show` when displaying
promises or asynchronous renderers.

```ts
const paths = await find("extensions/**/*.ts");
state.hits = await grep("registerTool", paths);
await show(state.hits);
await show(state.hits.context(3));
await show(state.hits.enclosing());
```

```ts
const source = await read("src/example.ts");
await show(source.outline());
await show(source.lines(40, 80)); // 1-based, inclusive
```

- `find(glob?, {paths?: string|string[], hidden?: boolean}?)` returns paths,
  respecting ignore files; brace globs are supported. Ignored trees such as
  `node_modules` are not searched from the project root; name the ignored tree
  explicitly in `{paths: "node_modules"}` to enumerate it. Explicit file
  reads/searches may name ignored files.
- `read(path)` returns a source snapshot with `path`, `text`, `rows`,
  `lines(start?, end?)`, and `outline()`.
- `grep(pattern: string|RegExp, paths?: string|string[], options?)` returns a
  selection. Paths also accept a `read()` result or a selection: their **files**
  are searched afresh, not just the selected rows. With paths omitted, options
  may be the second argument: `grep("TODO", {glob: "*.ts"})`. Options: `glob`,
  `ignoreCase`, `literal`, `limit`. Matching uses
  JavaScript regular expressions against the same snapshots that supply anchors;
  ripgrep enumerates files rather than matching their contents.
- Selections expose `rows`, iteration, `filter(fn)`, `slice(start?, end?)`,
  `context(n)`, `enclosing()`, and `complete`. `map(rowFn)` returns an ordinary
  array; `join(separator = "\n")` joins row text without anchors.
  Filtering and slicing preserve source references; slice uses ordinary zero-based, end-exclusive array indices.
  A row is `{anchor, text, path, line}`: `sel.rows[0].anchor` or
  `[...sel][0].anchor` gives an edit target (`line` is one-based). Context and enclosing definitions refer
  to the original snapshot, not a fresh version of the file.
- Text display has an **8 KiB budget per show call** (per output handle); console
  calls count as shows. `await show.large(value, ...)` gives that one call **32 KiB**.
  Relevance filtering fits text to the budget first, omitting passages with pull
  ids; anything still over is cut, with a notice in that show counting omitted
  UTF-8 bytes. Retained values are unchanged: select a smaller slice or use
  `show.large`. The budget is shared by the arguments of one call, so show several
  files as separate calls, one selection each. For large web pages, fetch to a file
  (`sh("curl -L URL -o page.html")`) and read/grep slices instead of displaying
  the whole response. A larger display does not change fetch/provider limits.
  Budgets exclude the short omission notice and image payloads. Object inspection
  and source/trace previews retain their own formatting limits.
- Display is bounded; source values are not display-truncated. An explicit search
  limit can make `complete` false. Check it before treating results as exhaustive.

All source views share the four-character anchor ledger. Allocation prefers a
file-specific initial character, then spills into other prefixes when full;
the session-wide limit is 1,048,576 issued names (live plus retired), with an explicit
capacity error before writing. Known edits preserve untouched row identities; retired
names cannot revive, including after resume. External changes still use line-diff
correspondence, which is ambiguous for some repeated rows.
Slicing or expanding a selection preserves provenance. Arbitrary strings and shell output
are not editable source references.

## Images

`await show(await read("screenshot.png"))` emits a real model-visible image, not
base64 text. PNG, JPEG, GIF, WebP, and BMP follow pi's detection, conversion, and
resizing pipeline (up to 2000×2000 pixels and 4.5 MB base64 per image). Unsupported
image formats and other binary files fail clearly. Each cell or notification emits
at most 8 images / 20 MiB base64, with a visible warning if that limit is reached;
this is independent of the text cap.

An image value exposes `path`, `mimeType`, `width`, `height`, and `note`, but no
editable anchors or text-source methods. Its payload stays private during ordinary
object inspection. Save the value in `state` to display it again without rereading.

`show` also accepts values with a `content()` method returning ordered pi text/image
blocks; `render()` remains the text-only rendering convention.

## Edit

```ts
await show(await edit`
=abcd
replacement

>wxyz
inserted after
`);
```

The DSL: `=a` replaces one line, `=a b` an inclusive
range, `-a` / `-a b` delete, `>a` inserts after, `<a` before. Here `a` and `b`
stand for actual four-character anchors. A separate `@path` token asserts the target
file: `=abcd wxyz @src/file.ts`. Attached forms such as `wxyz@src/file.ts`
are invalid. Copy anchors from `abcd│text`, not displayed line numbers.
Separate hunks with a blank line; an unescaped header-like body line or lone `@path` is an error.
Header recognition does not depend on whether
the anchor is current: unknown targets reject rather than becoming body text.
The only way to write a header-like line as content is to prefix it with `\` in the DSL
(`\=abcd`); double that escape to retain a leading backslash. JavaScript string
escaping still applies.

Empty `>anchor` / `<anchor` insertion bodies insert one blank line. Range
replacement is inclusive and literal: do not include text outside the selected
range in its replacement. Empty replacement bodies still require explicit
`-anchor` deletion.

Structured edits use the same checked engine, without parsing payload text:

````ts
const { rows } = await read("notes.md");
await show(await edit([
  { before: rows[0], text: "# Notes" },
  { replace: [rows[1], rows[2]], text: "```ts\nconst x = 1;\n```" },
  { delete: [rows[3], rows[4]] },
  { after: rows[5].anchor, text: "Done." },
]));
````

Targets are source rows or anchor strings. `replace` and `delete` accept a
single target or `[first, last]` inclusive; `before` and `after` take one target.
`text` is required except for `delete`, which forbids it. Empty text is one
blank line, not deletion. Structured text is literal, including header-like
lines, pasted-anchor-looking prefixes, and trailing blank lines.

Computed replacements use the same checked engine:

```ts
await show(await replace(state.hits, (text, row) => text.replace("oldName", "newName")));
```

Changed targets reject stale references. Edits are not transactions across
files, and a cell is not a transaction: earlier writes survive a later error.
Edit rejection throws and stops an awaited cell; multi-file failures name files
already changed by that call. Earlier cell operations are not rolled back.
Do not blindly replay a failed cell.

## Shells and promises

On reset, bounded prefixes of running shells’ stdout/stderr already
received by the host are included as partial captures (up to 50 KiB per stream,
within the cell’s host output cap). Unflushed process buffers cannot be recovered.
Completed shells remain explicit-output-only. Long work needs no special handling:

```ts
state.checks = sh`bun test`;
show(state.checks); // arrives as a late handle if it takes longer than the yield
```

Later, if something depends on it:

```ts
await wait("c7.2"); // or: const check = await state.checks;
```

`sh(command)` also works. Its result contains `stdout`, `stderr`, and
`exitCode`; a nonzero exit code is a result, not a rejected promise. Inspect it
rather than assuming a resolved promise means a successful command. Each stream
is captured up to 1 MiB with `stdoutTruncated` / `stderrTruncated` flags; redirect
large logs to a file when their complete contents matter. Tagged-template
interpolation inserts literal shell text, not automatically quoted arguments.

`show(await sh(...))` prints literal stdout/stderr under compact exit/truncation
metadata. The retained result remains an ordinary structured value; spreading it
into a new object opts back into normal object inspection.
A retained promise can be awaited again in any later cell.

## Literal text payloads

**For backticks or `${`, use ordinary double-quoted strings, not templates.**
This single idiom works for all three APIs; use `\n` or an array of lines
joined with `"\n"` for multiline payloads. Only double quotes and backslashes
need JavaScript escaping; backticks and `${` are inert. JSON tool-call encoding
is still a separate outer layer.

````ts
const text = ["```ts", "const label = `hello ${name}`;", "```", ""].join("\n");
await write("example.md", text);
const source = await read("example.md");
await edit([{ replace: source.rows[1], text: "const label = `bye ${name}`;" }]);
await show(await sh("cat <<'EOF'\n`literal ${name}`\nEOF"));
````

Structured `edit` also bypasses hunk-header parsing. `write` takes strings, not
a tagged template. No placeholder replacement or custom raw-string syntax is
needed. For text already in a file, pass `(await read(path)).text` directly.

### Templates for backslashes

**Prefer `sh.raw` for shell snippets and `edit.raw` for source containing
backslashes.** `sh.raw` and `edit.raw` preserve backslashes in template segments; existing
`sh`/`edit` tags remain cooked for compatibility. Substitutions are still literal,
not shell-quoted. JSON encoding and JavaScript template delimiters still apply:
`raw` does not disable `${...}` interpolation or make unescaped backticks literal.
Use `write(path, text)` or the string form of `edit` for already assembled text.

```ts
await show(await sh.raw`printf 'one\ntwo\n'`);
await show(await sh.raw`printf '%s\n' '{"file":"ok","line":7}' | jq -r '"\(.file):\(.line)"'`); // ok:7
await edit.raw`=abcd
const pattern = /\d+/;`;
```

Inside `sh.raw`, write jq interpolation as `\(.file)`, not `\\(.file)`:
raw preserves the extra backslash too. The tool-call JSON representation escapes
backslashes for transport; do not add that escaping again in the TypeScript source.

Use `grep(/pattern/, paths)` instead of nesting a regex in shell quoting, and
`replace(selection, fn)` when source-preserving transformations avoid rebuilding
a hunk. Ordinary `sh(string)`/`edit(string)` remain useful for assembled input.

## Loading skills

```ts
const skill = await loadSkill("/path/to/skill/SKILL.md"); // directory also accepted
await show(skill);
await show(skill.commands); // command, status, stdout/stderr, capture flags
```

`loadSkill` is in the fs module. It reads raw source, adds path context, and runs
original inline/fenced dynamic shell placeholders sequentially with workspace cwd
and `PI_SKILL_DIR`/`PI_WORKSPACE` set. This is per-command environment, not
a change to the REPL’s ambient environment. Each explicit load executes them once;
showing the retained value again does not. Generated output is not scanned for
more commands. Failures are visible in the expanded text and command outcomes.
The result retains `{path, text, commands, content()}` without editable anchors.
Use `read` or `grep` to inspect/edit a skill without activating its placeholders.

## Writing files

`await write(path, content)` creates parent directories and overwrites UTF-8 text.
Paths resolve against the kernel process cwd; the result is `{path, bytes}` with
an absolute path and UTF-8 byte count. This is an unchecked whole-file write; use
anchored `edit`/`replace` for checked changes. Overwriting does not bless old anchors.

## Host services

`exa`, `term`, and `ui` call the extension host asynchronously.

Their results remain structured and are not display-truncated: retain them, filter or map in
TypeScript, then `show` the selected data. There is no `pipe` option on these APIs.
The promises can be shown for a late result and awaited again in a later cell.
`host.call(namespace, method, args)` is the low-level equivalent; arguments and
results cross the process boundary as JSON-compatible data.

### Exa

`exa.search(query, options?)` returns the Exa response object, including
`results`, `requestId`, `statuses`, and `costDollars` when provided. An array of
queries runs in parallel and returns `{responses: [{query, ...response}]}`, retaining
attribution and metadata for each query. `exa.contents(urls, options?)` returns
one response object.

Search options: `numResults` (10), `type` (auto), `category`, `includeDomains`,
`excludeDomains`, `startPublishedDate`, `endPublishedDate`, `content`
(highlights, text, or none), `maxCharacters`, `maxAgeHours`.
Contents options: `maxCharacters` (10000), `verbosity` (compact, standard, full),
`includeSections`, `excludeSections`, `maxAgeHours`. Credentials and endpoint
configuration are unchanged: `EXA_API_KEY` and optional `EXA_API_URL`.

### Orca

The auto-loaded `orca` library talks to the native CLI from the kernel. It preserves Run/Task/Dispatch identities and FIFO delivery acknowledgments. Show long waits (`show(orca.check({wait: true}))`); the result arrives by handle. Showing a message never acknowledges it. [API and lifecycle](../../docs/orca.md).

Legacy board/workmux libraries remain in the repository for rollback; neither their namespaces nor board wake hooks are enabled by this package.

### Persistent terminals

The session extension owns terminal processes and alerts; the REPL only holds
references. Kernel interruption or reset does not kill them. Use stable IDs to
reattach after reset, and `term.end(id)` to terminate explicitly.

```ts
const [terminal] = await term.spawn({terminals: [
  {command: "bash --noprofile --norc", name: "scratch", notifyOnExit: true}
]});
await show(await term.send(terminal.id, "printf 'ready\\n'"));
await show(await term.view(terminal.id, {lines: 100}));
await term.end(terminal.id);
```

- `term.spawn({terminals})` returns snapshots. Each terminal accepts `command`,
  optional `cwd`/`name`, and one-shot `notifyOnExit`/`notifyOnOutput` alerts.
- `term.view(id, {lines?, cursor?, waitMs?}?)` returns a snapshot.
- `term.send(id, text, {submit?}?)` pastes literal text; submit defaults to true.
- `term.sendRaw(id, keys)` sends control keys such as `["C-c"]`.
- `term.wait({ids, mode?, cursors?, waitMs?, lines?})` returns
  `{mode, snapshots, changed, timedOut?}`. `any` waits for output change or exit;
  `all` waits for every terminal to exit. The default timeout is 30 seconds.
- `term.list()` returns summaries; `term.end(id)` terminates and returns `{id, ended:true}`.

Snapshots retain `id`, `status`, `exitCode?`, `cursor`, and literal `output`.
`show` renders snapshots/batches with compact metadata and readable output.
Capture is a bounded terminal scrollback view (default 200 lines, maximum 2000),
not a complete process log. There is no shell-pipe option; select values in JS.

### Desktop computer use

`ui` exposes the pinned Cua Driver 0.28.2 **native tool protocol**. Method and
argument names are snake_case; results retain Cua's `structuredContent` without
an intermediate outline, capability flags, refs, or action language.

```ts
await show(await ui.help("get_window_state")); // installed native schema + exec policy
const apps = (await ui.list_apps({})).structuredContent.apps;
const windows = (await ui.list_windows({pid, on_screen_only: true})).structuredContent.windows;
const view = await ui.get_window_state({pid, window_id, include_screenshot: true});
await show(view); // ordered native text/image blocks; no implicit display on capture
const field = view.structuredContent.elements.find(e => e.role === "AXTextArea");
await show(await ui.set_value({pid, window_id,
  element_token: field.element_token, value: "Replacement text"}));
// Re-observe or verify_state to check the actual effect.
```

Methods: list_apps, list_windows, get_window_state, verify_state, click, type_text,
press_key, set_value, scroll, drag, help, and reset. Use `ui.help(name)` for native schemas;
there is no unrestricted callTool escape hatch. The driver retires idle session
labels (`session_ended`): exec starts a fresh label on that refusal, re-issuing
reads and failing writes until re-observed. `ui.reset()` restarts the driver
process itself for anything worse; observations made before it are gone.

Use `computer.run/step/walk` for goal-directed browser and desktop interaction:
Jev selects actions while the parent supplies scope, intent, completion conditions,
and exact text. Use direct tools for inspection, setup, deterministic replay,
debugging, or unsupported actions. When a browser CLI is needed, prefer
`chrome-devtools-axi`. See [computer composition](../../docs/computer.md) for native
Cua and Playwright drives.

Exec's additions are only host policy and lifetime:

- An exact safe-integer pid/window_id is required for scoped operations. No
  desktop/frontmost fallback. Native window targets are also accepted where Cua
  supports them, but conflicting identities are refused.
- Exec owns the native session, serializes calls, forwards cancellation, and
  shuts the driver down on session/branch changes. Caller-supplied session labels
  are rejected. Routine startup does not request permissions.
- Background delivery is explicit by default. `delivery_mode: "foreground"`
  opts in for that write only; no automatic escalation/retry. set_value is native
  AX replacement and has no foreground mode. type_text is insertion.
- Observe before writing. A current native element_token or snapshot_id is
  required; one write consumes the observation even on error. verify_state also
  invalidates action tokens. Re-observe after either before another write.
- No native snapshots are journaled/restored. Tokens must not be reused after
  reload, session/branch changes, or shutdown. Read prior results as historical
  evidence only. Native query/completeness and verification results stay intact.

Install with `bun install --frozen-lockfile --ignore-scripts` and restart Pi.
/computer-use reports permissions; /computer-use setup explicitly requests them
for the host process. Missing optional native support disables only ui. Do not
load the old pi-computer-use extension alongside it. /exec-reset alone does not
replace the extension-host backend.

[Background guide and encounter](../../docs/guide/cua-background.md). Background
routing permits working in another app; it does not isolate concurrent writers
to the same window or guarantee compatibility with every app.

## Lifetime and boundaries

The kernel is a separate process, not a security sandbox. Code has the user's
machine permissions, but no raw pi extension host object. Interrupting a cell
kills the kernel and its subprocesses. Reload, session changes, tree navigation,
and reset discard state; code is never replayed. Anchors persist in session
entries and can be restored when the corresponding content still matches.
The host service instance and tracked workers survive kernel-only interruption or
reset. Actual session changes recreate it. Outstanding host RPCs are cancelled;
fetches and waits stop, and stale callbacks cannot mutate the next session. Created
workers and completed git operations are not rolled back.

Outlines use tree-sitter and Markdown, not the legacy model fallback.

Inner operations do not fire individual pi tool events. Exec marks final result
details with `piBetterSkills: {version: 1, handling: "explicit"}`. Compatible
pi-better-skills middleware leaves marked results alone—no heuristic skill reads,
glob injection, frontmatter overrides, or dynamic execution. Explicit `loadSkill`
owns expansion; ordinary `read`/`grep` stay raw and editable. This contract requires
the companion pi-better-skills patch; stock 1.3.2 does not recognize it. The
patched fork is `mlegls/pi-better-skills`, branch `explicit-skill-ownership`,
pinned in the local pi configuration as
`git:github.com/mlegls/pi-better-skills@a87cfcc94bf2683c89a96377f86fdf6cade82e89`.
Upstream proposal: https://github.com/edxeth/pi-better-skills/pull/4.
Keep updates explicit: retain the ownership patch and check that raw reads stay
raw and explicit loads expand once before advancing the pin.
The portable patch is `patches/pi-better-skills-explicit-output.patch` at the
repository root. On an unpatched 1.3.2 checkout, apply its two commits with
`git -C <better-skills-checkout> am <absolute-path-to-patch>`; do not reapply it
to an already patched checkout. Setup does not silently mutate external packages.
Other middleware may still transform output; tool-specific approval and monitoring
extensions need exec-aware integration.

## Dogfooding

Use exec while developing or verifying it. Report concrete friction: the operation
attempted, what actually happened, the workaround, and a simpler interaction if
one is apparent. Record unresolved observations in `docs/frictions.md`; workers
should include them in their Orca completion report so the coordinating session can
consolidate duplicates. Distinguish observations from proposed improvements.

Worker profiles with an explicit `--tools` allowlist must include `exec`.
Hiding the old file tools does not override that allowlist.

### Intent-driven UI

`computer.run({ui, apps, goal, until, ...})` delegates a bounded AX intent to Jev; `computer.step(options, history)` exposes the same loop for scripts. Hooks supply text, gate actions, and retain screenshots/state. See [computer use](../../docs/computer.md). Driver completion is not a verification assertion.
