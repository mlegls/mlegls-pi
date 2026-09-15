# exec

One tool for a persistent TypeScript REPL. Replaces the advertised file/shell,
Exa, workmux, board, terminal, and desktop-control tools with composable functions.
Requires Node 22.13+ and ripgrep (`rg` on PATH or pi's installed copy).

Reload pi (`/reload`) to enable it. Use `/exec-reset` to stop the kernel and
its subprocesses and clear bindings without discarding file anchors.

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

Cells use Node’s TypeScript transform before evaluation in the persistent REPL.
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

Use the same flags in a workmux agent's existing frontmatter:

```yaml
---
name: focused-worker
runCommand: pi --tools exec --exec-modules fs,sh,board
---
```

Keep `board` enabled when using the standard workmux worker reporting preamble.

No separate frontmatter parser or worker-specific configuration is needed. This
limits the supplied API, **not** filesystem/process permissions: arbitrary
imports and enabled shell commands can still access underlying capabilities.
The full reference below describes all modules; each session advertises only its
selected surface.


## Recovering shadowed capabilities

Convenient names are ordinary REPL bindings: `const read = ...` may shadow the
provided reader. The frozen `__exec` registry keeps the original enabled
capabilities, including `show`, `notify`, and module namespaces.

```ts
const read = (x: string) => x.toUpperCase();
await __exec.show(await __exec.read("README.md"));
```

If `__exec` itself is shadowed, use `globalThis.__exec`. That global property
cannot be assigned or deleted. The registry and supplied API wrappers are frozen;
returned values are not. A shadowing `const` cannot be reassigned or removed: use
the registry or another name rather than resetting and losing useful bindings.
Disabled modules remain absent and host calls remain gated. This is recovery
from accidental shadowing, not protection against deliberate runtime tampering.

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
- Text display has a **16 KiB per-cell** budget. `await show.large(value, ...)`
  explicitly raises that cell’s budget to **50 KiB**, including other show/console
  output in that cell. It does not replay text already omitted. An end-of-cell
  notice counts omitted rendered UTF-8 bytes; retain values and retry in a new
  cell with `show.large`, or select smaller slices. Notification text uses 16 KiB.
  Budgets exclude the short omission notice and image payloads. Object inspection
  and source/trace previews retain their own formatting limits.
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
this is independent of the text cap.

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

## Literal templates

`sh.raw` and `edit.raw` preserve backslashes in template segments; existing
`sh`/`edit` tags remain cooked for compatibility. Substitutions are still literal,
not shell-quoted. JSON encoding and JavaScript template delimiters still apply.

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
- `board.read({topic?, tags?, limit?}?)` returns `{messages, omitted}`. The default
  selection is the newest 20 matches, returned in log order. Each message has
  its stable `line` number. `omitted` counts older matching messages excluded by
  the query limit; this is separate from display truncation.
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
and reset discard bindings; code is never replayed. Anchors persist in session
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
the companion pi-better-skills patch (local dependency commit `a87cfcc` on
1.3.2); stock 1.3.2 does not recognize it. Retain/reapply that patch when updating
the dependency until it is supported upstream.
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
