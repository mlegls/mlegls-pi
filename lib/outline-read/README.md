# outline-read

Shared anchor ledger, edit engine, and outline sources used by
[`exec`](../exec/README.md). The standalone tool adapters remain available
for tests and embedding but are no longer registered by this package.
The sections below describe those legacy adapters; the exec API uses
structured selections instead of path selectors and `pipe` parameters.

- `read` returns files over a line threshold as an outline: definitions and
  headings are shown, bodies are replaced by `⋯ start-end` markers, and the
  model reads the ranges it needs with a selector on the path.
- Every served line is prefixed with a 4-character anchor (`abcd│text`).
  `edit` addresses lines by anchor, without a path: anchors are unique across
  files. They stay valid across edits made in the session and across resume;
  a line that changes on disk gets a new one.

- `grep` groups matches by file and enclosing definition or heading, and
  every shown line carries its anchor, so grep → edit needs no read.

Outline sources, tried in order: tree-sitter (JS, TS, TSX, Python, Go, Rust,
Java), markdown headings, then a model-generated outline for anything else.

## Read selectors

| Path | Returns |
| --- | --- |
| `src/a.ts` | full file if at most `thresholdLines` lines, otherwise the outline |
| `src/a.ts:50-200` | lines 50 to 200 |
| `src/a.ts:50+30` | 30 lines from 50 |
| `src/a.ts:50-` | from 50 to the end |
| `src/a.ts:5-16,40-80` | several ranges in one call, merged when adjacent |
| `src/a.ts:all` | whole file regardless of size, capped at `maxLines` / `maxBytes` |
| `src/a.ts lib/b.ts:1-40 "c d.md"` | several files (and selectors) in one call, a blank line between them |

`pipe` runs the anchored output through `bash -c`; lines that survive keep
their anchors, so `path:all` + `pipe: rg -n TODO` is a grep whose hits are
directly editable.

`offset` and `limit` parameters are accepted as an alternative to a selector.
A literal filename containing `:` wins over the selector reading when it exists.

## Edit

One string, hunks separated by a blank line; a hunk is a header line, then
the new lines. Anchors are unique across the session's files, so there is no
path and one call can touch several files.

```
=k7pd m2xa
replacement
lines

-q9rt

>b4nn
inserted after b4nn

<b4nn
inserted before b4nn
```

`=` replaces a line or an inclusive range, `-` deletes one (no body), `>`
inserts after, `<` before. A header may end with a separate `@path` token (`=abcd wxyz @src/file.ts`) to assert which
file the anchors belong to. A file's anchors all start with the same
character (a hash of its path), so one from the wrong file looks wrong. A pasted read row (`=abcd│text`) works as a
header. A blank line inside a body is content unless the line after it is a
syntactic header. An unescaped header-like body line or lone `@path` is an error;
a backslash prefix is the only way to write one as content (double it to retain
the backslash). Unknown targets reject; they do not become replacement text.
Malformed compact headers such as `=1`
after a separator reject with grammar help.

Hunks apply together per file and must not overlap. Unknown anchors reject
the whole call; if a file changed on disk, the changed lines are returned
with their current anchors so the retry needs no read. Pasted `abcd│`
prefixes in body lines are stripped with a warning.

## Grep

Same parameters as the built-in (`pattern`, `path`, `glob`, `ignoreCase`,
`literal`, `context`, `limit`), plus `pipe`. `path` may name several roots,
whitespace-separated; with more than one, shown paths are relative to cwd. Output:

```
src/lsp-client.ts
  LspClientManager.stopConnection (242-254)
    >  248 k7pd│    const conn = this.connections.get(key);
       249 m2xa│    if (!conn) return;
  fileUri (126-128)
       127 8iqi│	return 'x';
```

`>` marks match lines when `context` is set. The definition chain comes from
the tree-sitter or markdown source; the model fallback is never used by grep.
Files beyond `grepAnchorFiles` are listed as `path:line:` only.

## Configuration

`~/.pi/agent/outline-read.json`, overridden per project by
`<project>/.pi/outline-read.json`. Keys are shallow-merged; `fallback` is
merged one level deeper. All keys are optional.

```json
{
  "thresholdLines": 200,
  "minBodyLines": 3,
  "budgetTokens": 10000,
  "maxLines": 2000,
  "maxBytes": 51200,
  "grepAnchorFiles": 30,
  "fallback": {
    "enabled": true,
    "model": "openai-codex/gpt-5.6-luna",
    "thinking": "medium"
  }
}
```

| Key | Default | Meaning |
| --- | --- | --- |
| `thresholdLines` | `200` | Files with at most this many lines are returned in full. |
| `minBodyLines` | `3` | Bodies shorter than this stay inline instead of being elided. |
| `budgetTokens` | `10000` | Estimated token budget for an outline. Level 0 elides leaf bodies; level 1 also elides class-like bodies except nested definitions; level 2 keeps only top-level definitions with child counts. The level rises until the outline fits. |
| `maxLines`, `maxBytes` | `2000`, `51200` | Caps per response for full and ranged reads; the response says how to continue. |
| `grepAnchorFiles` | `30` | Files per grep call that are read, anchored, and outlined; the rest are listed as `path:line:`. |
| `fallback.enabled` | `true` | Ask a model for an outline when no structural source supports the file. When `false`, such files are returned in full (subject to the caps). |
| `fallback.model` | `openai-codex/gpt-5.6-luna` | Passed to `pi --model`. |
| `fallback.thinking` | `medium` | Passed to `pi --thinking`: `off`, `minimal`, `low`, `medium`, `high`, `xhigh`, `max`. |

The fallback runs `pi -p` with no extensions, skills, or context files, and
caches results in `~/.pi/agent/outline-read-cache/` keyed by model, thinking
level, and file content. The first outline of a file blocks the tool call for
as long as the model takes; later reads of unchanged content are instant.

## Anchors and the ledger

Anchors are derived from a content hash so an unchanged file gets the same
names in every session, bumped when two lines in a file would collide. A
per-file ledger tracks anchored lines; on every read or edit it is
reconciled with the file by line diff, so unchanged lines keep their anchors
and new lines get fresh ones. The ledger is stored as `outline-read` custom
entries in the pi session (anchors plus a content hash), which makes it
branch-aware and restores it on resume when the file is byte-identical.
