# Codemode read first use

Implementation revision: `45f505a4` (base `a52c3e82d1987b71c13dedc6c81df55b94a9c249`).

## Prepared setup and entry point

Local library/QuickJS sandbox, owned by this worker checkout; no deployment,
model, persona, authentication or secrets required. `mise run setup` completed
before implementation. From a checkout containing this packet:

```sh
bun docs/attachments/codemode-image-read-returns-only-the-caption/try-read.ts
```

This entry point was opened successfully. It creates a temporary valid 1×1 red
PNG (`x.png`) and text file (`hello.txt`), registers the actual read adapter, and
runs codemode with the schema-bearing result selection used by pi. Temporary
files and the sandbox are cleaned up on exit. An optional first argument replaces
the script body, e.g.:

```sh
bun docs/attachments/codemode-image-read-returns-only-the-caption/try-read.ts 'image(await tools.read({path: "x.png"}))'
```

For full interactive host driving, start a fresh installed pi session from the
implementation checkout with `pi --no-session -e ./extensions/fragment/index.ts`.
The existing parent session's tool registration is not hot-reloaded by this patch.

## Observed first use

- `image(await tools.read({path: "x.png"}))` succeeded: QuickJS emitted an
  `image/png` item with 73 decoded bytes, rather than an invalid-output error.
- Text read produced `hello.txt (1 lines)\nhello from text` as a string.
- Mixed `hello.txt x.png` read returned an ordered array. Sending its second item
  to `image()` emitted the same PNG; its first item remained the text string.
- Sandbox result was `ok: true`, with two image and two text output items.

This is nonvisual API evidence (`visual: false`); no rendered UI was judged.
The sandbox uses the registered adapter and real codemode `image()` implementation,
but supplies pi's structured-result selection itself, rather than starting an
LLM-driven interactive session. The repository dependency is pi 1.0.0 (its builtin
read lacks structuredContent); installed pi 1.2.0 documents the image contract.
The adapter preserves builtin structuredContent when available and derives the
same block from content for the older dependency.

## Focused checks

- `bun test lib/outline-read`: **44 passed, 0 failed**, including the ticket-approved
  read contract smoke test (schema validation, single image, text, two text files,
  mixed multi-file read with two images and preserved attachment blocks).
- `bun run typecheck`: passed.
- `git diff --check`: passed before commit.

The initial smoke run failed because the chosen base64 PNG fixture was invalid
and builtin image processing correctly returned an omission note. Replacing it
with a valid Photon-generated 1×1 PNG made the focused run pass. No production
behavior was changed to accommodate the invalid fixture.
