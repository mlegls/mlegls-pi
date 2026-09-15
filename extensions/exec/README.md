# exec

One tool for a persistent TypeScript REPL. Replaces the advertised `bash`,
`read`, `edit`, `grep`, and `find` tools; other tools, including `write`,
remain available. Requires Node 22.13+ and ripgrep (`rg` on PATH or pi's
installed copy).

Reload pi (`/reload`) to enable it. Use `/exec-reset` to stop the kernel and
its subprocesses and clear bindings without discarding file anchors.

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
`notify(promise, label?)` returns the original promise. Plain detached promises
do not request a turn; `notify` does.

## Lifetime and boundaries

The kernel is a separate process, not a security sandbox. Code has the user's
machine permissions, but no raw pi extension host object. Interrupting a cell
kills the kernel and its subprocesses. Reload, session changes, tree navigation,
and reset discard bindings; code is never replayed. Anchors persist in session
entries and can be restored when the corresponding content still matches.

This first version reads text only. Outlines use tree-sitter and Markdown, not
the legacy model fallback. Image reads are not yet exposed through exec.

Inner operations do not fire individual pi tool events. In particular,
pi-better-skills does not process exec's `read`/`sh` calls: **SKILL.md is raw
anchored source**, dynamic placeholders have not run, and relative paths are not
rewritten. Execute needed placeholders explicitly with `PI_SKILL_DIR` and
`PI_WORKSPACE` set, and use explicit paths for bundled skill files. Tool-specific
approval or monitoring extensions likewise need an exec-aware integration.

## Dogfooding

Use exec while developing or verifying it. Report concrete friction: the operation
attempted, what actually happened, the workaround, and a simpler interaction if
one is apparent. Record unresolved observations in `docs/frictions.md`; workers
should include them in their board report so the coordinating session can
consolidate duplicates. Distinguish observations from proposed improvements.

Worker profiles with an explicit `--tools` allowlist must include `exec`.
Hiding the old file tools does not override that allowlist.
