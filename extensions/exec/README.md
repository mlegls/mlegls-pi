# exec

One tool for a persistent TypeScript REPL. Replaces the advertised file/shell,
Exa, workmux, board, terminal, and desktop-control tools with composable functions.
Requires Node 22.13+ and ripgrep (`rg` on PATH or pi's installed copy).

Reload pi (`/reload`) to enable it. Use `/exec-reset` to stop the kernel and
its subprocesses and clear bindings without discarding file anchors.

## Pi presentation

Collapsed exec rows summarize the operations actually invoked, not the first
printed lines or a guess from the TypeScript:

```text
exec  ✓ sh · read ×2 · edit · board.send
```

Expand the row with pi's tool-expansion key to see calls in invocation order,
their arguments, bounded result previews, durations, and pending/error states.
Explicit `show` output has its own section; the original TypeScript follows.
Concurrent calls retain invocation order rather than completion order. A retained
job can still be pending when its cell ends; tracing does not wait for it.

The trace is presentation-only, stored in tool-result details in the session log.
It adds nothing to model-visible output and does not replace `show`. Arguments
and results can contain sensitive data even when not explicitly shown; traces are
not a credential-redaction mechanism. Image payloads are excluded from previews.

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
| `fs` | `read`, `write`, `find`, `grep`, `edit`, `replace` (including image reads) |
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

Use the same flags in a workmux agent's existing frontmatter:

```yaml
---
name: focused-worker
runCommand: pi --tools exec --exec-modules fs,sh,board
---
```

No separate frontmatter parser or worker-specific configuration is needed. This
limits the supplied API, **not** filesystem/process permissions: arbitrary
imports and enabled shell commands can still access underlying capabilities.
The full reference below describes all modules; each session advertises only its
selected surface.

## Read, select, display

Each tool call has one parameter, `code`. Bindings and promises survive calls.
Only `show(...)` / `console.log(...)` emit output. Await `show` when displaying
promises or asynchronous renderers.

```ts
const paths = await find("extensions/**/*.ts");
const hits = await grep("registerTool", paths);
await show(hits);
await show(hits.context(3));
await show(hits.enclosing());
```

```ts
const source = await read("src/example.ts");
await show(source.outline());
await show(source.lines(40, 80)); // 1-based, inclusive
```

- `find(glob?, {paths?: string|string[], hidden?: boolean}?)` returns paths,
  respecting ignore files. Explicit file reads/searches may name ignored files.
- `read(path)` returns a source snapshot with `path`, `text`, `rows`,
  `lines(start?, end?)`, and `outline()`.
- `grep(pattern: string|RegExp, paths?: string|string[], options?)` returns a
  selection. Options: `glob`, `ignoreCase`, `literal`, `limit`. Matching uses
  JavaScript regular expressions against the same snapshots that supply anchors;
  ripgrep enumerates files rather than matching their contents.
- Selections expose `rows`, iteration, `filter(fn)`, `slice(start?, end?)`,
  `context(n)`, `enclosing()`, and `complete`. Filtering and slicing preserve
  source references; slice uses ordinary zero-based, end-exclusive array indices.
  A row is `{anchor, text, path, line}`. Context and enclosing definitions refer
  to the original snapshot, not a fresh version of the file.
- Display is bounded; source values are not display-truncated. An explicit search
  limit can make `complete` false. Check it before treating results as exhaustive.

All source views share the existing four-character anchor ledger. Slicing or
expanding a selection preserves provenance. Arbitrary strings and shell output
are not editable source references.

## Images

`await show(await read("screenshot.png"))` emits a real model-visible image, not
base64 text. PNG, JPEG, GIF, WebP, and BMP follow pi's detection, conversion, and
resizing pipeline (up to 2000×2000 pixels and 4.5 MB base64 per image). Unsupported
image formats and other binary files fail clearly. Each cell or notification emits
at most 8 images / 20 MiB base64, with a visible warning if that limit is reached;
this is independent of the 50 KiB text cap.

An image value exposes `path`, `mimeType`, `width`, `height`, and `note`, but no
editable anchors or text-source methods. Its payload stays private during ordinary
object inspection. Keep the value in a binding to display it again without rereading.

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

The existing DSL is unchanged: `=a` replaces one line, `=a b` an inclusive
range, `-a` / `-a b` delete, `>a` inserts after, `<a` before. Here `a` and `b`
stand for actual four-character anchors. An optional `@path` asserts the target
file. Separate hunks with a blank line.

Computed replacements use the same checked engine:

```ts
await show(await replace(hits, (text, row) => text.replace("oldName", "newName")));
```

Changed targets reject stale references. Edits are not transactions across
files, and a cell is not a transaction: earlier writes survive a later error.
Do not blindly replay a failed cell.

## Shells and promises

```ts
const checks = sh`bun test`;
notify(checks, "tests"); // one completion/error notification, even after this cell
```

Later:

```ts
const result = await checks;
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
- `board.read({topic?, tags?, limit?}?)` returns `{messages, omitted}`. The default
  selection is the newest 20 matches, returned in log order. Each message has
  its stable `line` number. `omitted` counts older matching messages excluded by
  the query limit; this is separate from display truncation.
- `board.list({topic?}?)` returns `{topics, subscriptions}`.
- `board.subscribe({topic, tags?, wake?, remove?})` changes this session's
  subscription. Wake defaults to true; subscriptions survive session restoration.
- `board.ack(ids)` acknowledges specific messages already handled.

Reading values does **not** acknowledge them. Neither does `wm.wait`. This keeps
filtered-away reports eligible for later delivery. Acknowledge the particular
messages you handled, rather than every message in a fetched batch:

```ts
const batch = await board.read({topic: "review/**"});
const chosen = batch.messages.filter(m => m.tags.includes("needs-input"));
await show(chosen);
await board.ack(chosen.map(m => m.id));
```

### Workmux

- `wm.spawn({run?, workers: [{handle, prompt, agent?, base?}], wake?, wait?})`
  returns `{workers, subscribed}`. The first spawn requires `run`; subsequent
  calls remember it. Reports subscribe through the board; `wake` defaults true.
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
- `wm.status()` returns structured status rows (`worktree` is the handle); `wm.agents()` lists agents and
  descriptions.

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

`ui` wraps the installed `@injaneity/pi-computer-use` extension, retaining its
setup, configuration, native helper, argument validation, and checked actions.
Use `chrome-devtools-axi` through `sh` for browsers; the three upstream
browser-specific tools are hidden and have no `ui` wrappers.

```ts
await show(await ui.help("act")); // original schema and guidelines
await show(await ui.findRoots({app: "TextEdit"}));
const view = await ui.observe({root: "@r1", mode: "visual"}); // use a returned ref
await show(view); // original text and actual screenshot images
await show(view.details.capture); // concise state/capture metadata
```

Methods: `findRoots`, `observe`, `search`, `expand`, `inspect`, `act`,
`readText`, and `waitFor`. Each takes the upstream argument object.
`ui.help(method?)` returns original descriptions, schemas, and prompt guidelines.
Refs remain tied to their returned `stateId`; browser and native state checks are
not bypassed. Results retain `details` and `isError`; image bytes stay private
until `content()` or `show`. Displayed error results preserve images and mark the
exec result as failed. Upstream thrown errors propagate normally.

Keep the npm package installed but disable its independent extension entry so
there is one owner, not two. In Pi's package settings:

```json
{"source": "npm:@injaneity/pi-computer-use", "extensions": ["-extensions/computer-use.ts"]}
```

The wrapper imports the public extension factory and captures registrations;
`/computer-use` remains available. Missing installation disables only `ui`,
not the rest of exec. Image-free operation details are journaled for upstream
session reconstruction; reconstruction has upstream's limits, not an unlimited
cache of prior observations.

## Lifetime and boundaries

The kernel is a separate process, not a security sandbox. Code has the user's
machine permissions, but no raw pi extension host object. Interrupting a cell
kills the kernel and its subprocesses. Reload, session changes, tree navigation,
and reset discard bindings; code is never replayed. Anchors persist in session
entries and can be restored when the corresponding content still matches.
The host service instance and tracked workers survive kernel-only interruption or
reset. Actual session changes recreate it. Outstanding host RPCs are cancelled;
fetches and waits stop, and stale callbacks cannot mutate the next session. Created
workers and completed git operations are not rolled back.

Outlines use tree-sitter and Markdown, not the legacy model fallback.

Inner operations do not fire individual pi tool events. SKILL.md snapshots are
raw anchored source: use explicit paths for bundled skill files, and execute needed
placeholders deliberately with `PI_SKILL_DIR` and `PI_WORKSPACE` set. Outer
middleware can still transform exec's displayed output; current skill expansion
hooks can mistake anchored lines for shell commands. Do not treat those transformed
displays as proof that skill setup ran successfully. Tool-specific approval and
monitoring extensions need exec-aware integration.

## Dogfooding

Use exec while developing or verifying it. Report concrete friction: the operation
attempted, what actually happened, the workaround, and a simpler interaction if
one is apparent. Record unresolved observations in `docs/frictions.md`; workers
should include them in their board report so the coordinating session can
consolidate duplicates. Distinguish observations from proposed improvements.

Worker profiles with an explicit `--tools` allowlist must include `exec`.
Hiding the old file tools does not override that allowlist.
