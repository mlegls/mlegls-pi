# exec

One tool for TypeScript cells with fresh local scope and persistent explicit state.
Replaces the advertised file/shell,
Exa, workmux, board, terminal, and desktop-control tools with composable functions.
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

## Cell deadline

Cells have a **30s host-enforced deadline**, including kernel startup but excluding
queue wait. Override explicitly on the current tool call:

```json
{"code":"await show(await sh`bun test`)","timeoutMs":120000}
```

`timeoutMs` is a positive integer in milliseconds (maximum 2147483647); it never
carries over to later calls. The host enforces it even if the kernel is in a
synchronous loop. Timeout preserves shown output, clears retained state, kills
the kernel and its shell process group, and aborts in-flight host calls. File
anchors and host-owned terminals survive. Filesystem and external side effects
are not rolled back: inspect before retrying. For long-running work, use `term`
or retain a promise in `state` and return from the cell without awaiting it.

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
Use retained promises or `notify` to observe later completion. Previews are capped
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

All modules are enabled by default. Select a surface with CLI flags:

```sh
pi --tools exec --exec-modules fs,sh,board
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
| `board` | `board.*` |
| `wm` | `wm.*` |
| `term` | `term.*` |
| `ui` | `ui.*` |

`fs` is a configuration group, not a new REPL namespace. Existing function names
are unchanged. `show`, `notify`, and `console` are always available. Disabled
module globals and API documentation are omitted; `host.call` also rejects
excluded namespaces. Selection survives kernel resets and session navigation.

Agent frontmatter supplies a stance, not a launch command. Use `route.prepare`
and `dispatch` to launch routed workers. Direct `wm.spawn` requires explicit
`model` and `effort`, or `command` for a custom process. `agent` only names a stance.
Keep `board` enabled when using the standard workmux worker reporting preamble.
Module selection limits the supplied API, **not** filesystem/process permissions: arbitrary
imports and enabled shell commands can still access underlying capabilities.
The full reference below describes all modules; each session advertises only its
selected surface.

## Project modules

`lib/<name>.ts` is in the cell as `<name>`, except names already in the exec API
(`board`, `wm`, and the rest of the module table). A project file
`.pi/exec/<name>.ts` shadows the lib file with the same stem. A name that is not
in `lib/` is `project.<name>`. Upstreaming is moving the file to `lib/`.

`autoread.run(request, options?)` runs a read-only reader fork of this
session and returns its final briefing. Exec passes `PI_SESSION_FILE` to the
kernel; reload the extension once after installing this change. See
[autoread](../../docs/autoread.md) for retained-promise usage and options.

`/exec-reset` (or a new session) re-imports; a running kernel keeps the modules
it started with.


## Cell scope and retained state

Each call has fresh scope: ordinary `const`, `let`, `var`, and function
names can be reused in the next call. No extra block is needed:

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

## Ingress filtering

`show(...)`, `show.large(...)`, console aliases, and `notify(...)` use the same
Jev relevance filter before the existing display budget. Omitted chunks have
recoverable `ing-*` IDs; retained values are never changed.

```ts
await show(await read("src/example.ts"));
await show.pull("ing-0123456789abcdef"); // omitted original, no rescoring
await show.raw(state.result);           // bypass relevance filtering
```

Raw/pull still obey byte/image caps. Loaded skills and images bypass relevance
filtering. Missing credentials, a scorer failure, or timeout keeps the original
text with a warning. [Policy, setup, and verification](../../docs/ingress.md).

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
- Text display has a **16 KiB per-cell** budget. `await show.large(value, ...)`
  explicitly raises that cell’s budget to **50 KiB**, including other show/console
  output in that cell. It does not replay text already omitted. An end-of-cell
  notice counts omitted rendered UTF-8 bytes; retain values and retry in a new
  cell with `show.large`, or select smaller slices. Notification text uses 16 KiB.
  For several files, retain each read on `state` and show one selection at a time;
  the budget is shared, not per argument. For large web pages, fetch to a file
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

On timeout/reset, bounded prefixes of running shells’ stdout/stderr already
received by the host are included as partial captures (up to 50 KiB per stream,
within the cell’s host output cap). Unflushed process buffers cannot be recovered.
Use `term` for long suites/clones, or retain a shell promise as below; increasing
`timeoutMs` also works. Completed shells remain explicit-output-only.

```ts
state.checks = sh`bun test`;
notify(state.checks, "tests"); // one completion/error notification, even after this cell
```

Later:

```ts
const result = await state.checks;
await show(result);
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
`notify(promise, label?)` returns the original promise and delivers bounded
text/image content on completion. Plain detached promises do not request a turn;
`notify` does.

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
await edit.raw`=abcd
const pattern = /\d+/;`;
```

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

`exa`, `board`, `wm`, `term`, and `ui` call the extension host asynchronously.

Their results remain structured and are not display-truncated: retain them, filter or map in
TypeScript, then `show` the selected data. There is no `pipe` option on these APIs.
The promises work with `notify` and can be awaited again in a later cell.
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

### Board

- `board.send({topic, body, tags?, data?})` returns the stored message.
- `board.read({topic?, tags?, limit?, fields?, bodyChars?}?)` returns
  `{messages, omitted, total}`. The default selection is the newest 20 matches,
  returned in log order. Each message has its stable `line` number. `omitted`
  counts older matches excluded by the query limit; pass `limit: total` to
  include all current matches. This is separate from display truncation.
  Use `fields: "meta"` for compact previews: no `data`, and at most `bodyChars`
  characters of body (default 120; 0 omits it). Shortened bodies carry
  `bodyTruncated: true`. The default `fields: "full"` preserves whole messages.
- `board.list({topic?}?)` returns `{topics, subscriptions}`.
- `board.subscribe({topic, tags?, wake?, remove?})` changes this session's
  subscription. Wake defaults to true; subscriptions survive session restoration.
  Removal returns `{topic, tags?, remove:true}`, without irrelevant wake settings.
- `board.ack(ids)` acknowledges specific messages already handled.
- `board.help(method?)` returns signatures and filter/acknowledgment semantics.

Read/subscribe filters accept tag expressions (`"done | blocked"`) or arrays
(`tags: ["done", "verified"]` means **all** those tags; `[]` means no filter).
Send tags remain arrays of literal tag names. Invalid types and malformed
expressions fail at the service boundary with an actionable error.

Reading values does **not** acknowledge them. Neither does `wm.wait`. This keeps
filtered-away reports eligible for later delivery. Acknowledge the particular
messages you handled, rather than every message in a fetched batch:

```ts
const batch = await board.read({topic: "review/**"});
const chosen = batch.messages.filter(m => m.tags.includes("needs-input"));
await show(chosen);
await board.ack(chosen.map(m => m.id));
```

### Board outside pi

The same board is available to other harnesses through `bun lib/board.ts`
(use the script’s absolute path when outside this checkout):

```sh
bun lib/board.ts read --topic "review/**" --fields meta --body-chars 80
bun lib/board.ts send review/unit --tag done --body "Verified"
bun lib/board.ts cursor  # {"offset": ...}; capture BEFORE starting workers
bun lib/board.ts wait --topic "review/**" --tags done --from-offset 123 --timeout 30000
```

CLI output is JSON. `wait` requires the captured byte offset so reports arriving
during startup are not lost; replace `123` with that cursor. Timeout exits 1.
The importable `waitFor` keeps its from-now default: pass `fromOffset` explicitly
for the same guarantee. Neither CLI reads nor waits acknowledge messages.
`PI_BOARD_DIR` selects an isolated log; `PI_BOARD_NAME` sets the CLI sender name.
This script does not replace any unrelated `board` executable on PATH.

### Workmux

- `wm.spawn({run?, from?: "fork" | "summary", workers: [{handle, prompt, model?, effort?, command?, agent?, base?, from?}], wake?, wait?})`
  returns `{workers, subscribed}`. The first spawn requires `run`; subsequent
  calls remember it. `from: "fork"` adds `--fork <parent session file>` to the
  agent's Pi command (file, not id: the child cwd is a different project).
  `from: "summary"` prepends an extract of the parent session to the prompt.
  Per-worker `from` overrides the batch. Reports subscribe through the board; `wake` defaults true.
  `wait:true` also returns outcomes and pending handles.
- `wm.wait({handles?, run?, mode?, timeoutMs?}?)` returns
  `{outcomes, pending, aborted}`. Mode is any (default) or all. Omitted handles
  use this session's tracked workers. Outcomes carry `handle`, `kind`, and
  either a full `message` or an idle/exited `tail`.
- `wm.send(handle, text, {run?}?)` sends a prompt.
- `wm.capture(handle, {run?, lines?}?)` returns `{handle, paneId, text}`; default
  lines is 50. Filter the text in TypeScript rather than piping it through a shell.
- `wm.merge(handles, {run?, into?, mode?}?)` merges in order; mode is merge
  (default) or rebase. Returns `{merged, into, mode}`, plus
  `conflict: {handle, files}` on conflict; the conflicting merge is aborted.
- `wm.close(handles, {run?, keepBranch?}?)` closes workers and unsubscribes;
  returns `{closed}`.
- `wm.status()` returns status rows using `handle` and `paneId`; `wm.agents()` lists agents and
  descriptions.
- `wm.help(method?)` returns method signatures and worker lifecycle semantics.

A failed batch spawn names both failures and successfully started handles; those
workers remain tracked. Cancellation does not undo created workers or git changes.

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

`ui` calls the public runtime from the pinned
[mlegls/pi-computer-use fork](https://github.com/mlegls/pi-computer-use).
The runtime owns native resources, argument validation, observations, and checked
actions; exec is a thin lifecycle and display adapter.
Use `chrome-devtools-axi` through `sh` for browsers; the three upstream
browser-specific tools are hidden and have no `ui` wrappers.

```ts
await show(await ui.help("act")); // original schema and guidelines
await show(await ui.findRoots({app: "TextEdit"}));
const view = await ui.observe({root: "@r1", mode: "visual"}); // use a returned ref
await show(view); // original text and actual screenshot images
await show(view.capture); // concise state/capture metadata; full .details retained
await show(await ui.search({stateId: view.capture.stateId, subrole: "CloseButton", unlabeled: true}));
```

Methods: `findRoots`, `observe`, `search`, `expand`, `inspect`, `act`,
`readText`, and `waitFor`. Native operations take the upstream argument object.
`search` additionally accepts `subrole`, `unlabeled`, and `limit` (1–1000, default
50). Any of these opts into **cached-outline discovery**, not native ranked
search: provide a captured `stateId`; roles/subroles/capabilities match exactly
(case-insensitive, ignoring AX prefixes), and text matches substrings. It walks
the whole captured outline before applying the result limit, retaining original
refs. Results report `totalMatches`, `hasMore`, `complete`, `truncatedNodes`, and
`scope: "cached-outline"`; completeness does not imply uncaptured UI is known.
Native inspection checks state validity before returning cached results.
The runtime retains the most recent 128 observations, including branch replay.
Re-observe evicted states; restoration does not restore the physical desktop.
`ui.help(method?)` returns original descriptions, schemas, and prompt guidelines.
Refs remain tied to their returned `stateId`; browser and native state checks are
not bypassed. Results retain `details` and `isError`; image bytes stay private
until `content()` or `show`. Displayed error results preserve images and mark the
exec result as failed. Upstream thrown errors propagate normally.

The fork is a root optional dependency pinned by Git commit in `package.json`
and `bun.lock`. Install with `bun install --frozen-lockfile --ignore-scripts`.
Remove the old `npm:@injaneity/pi-computer-use` entry from Pi package settings;
do not independently load its extension alongside exec. The public `./runtime`
and `./setup` exports share one runtime owner (one active instance per process).
Missing installation disables only `ui`, not shell or file operations.

`/computer-use` shows configuration; `/computer-use setup` explicitly starts
permission setup. Neither session startup nor routine readiness checks request
consent. Actual visual capture can still trigger macOS consent even when its
preflight check succeeds. Development installs should use `--ignore-scripts`:
rebuilding or re-signing the native helper can invalidate existing grants. The
fork preserves an already validly signed, same-version helper during setup.

Exec journals opaque, image-free incremental runtime snapshots in version-2
entries and replays them through the public restoration API. Cached reads do not
repeat stored observations. There is no registration capture, synthetic tool-result
projection, or separate outline cache. Pre-upgrade version-1 entries cannot be
replayed: re-observe once after upgrading. Corrupt snapshots fail within `ui`
without preventing the rest of exec from starting.

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
should include them in their board report so the coordinating session can
consolidate duplicates. Distinguish observations from proposed improvements.

Worker profiles with an explicit `--tools` allowlist must include `exec`.
Hiding the old file tools does not override that allowlist.
