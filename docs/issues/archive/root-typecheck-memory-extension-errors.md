---
stage: done
assignee: agent
author: session:01a0f08f-80da-77bd-81b5-aa7fc1c16359
---

While checking [[projects/mlegls-pi/issues/archive/address-the-waiting-child-in-exception-mail]], `bunx tsc --noEmit` reports errors in unchanged `extensions/memory` files:

- `images.test.ts:13` reads `.text` from a union that also includes image content.
- `index.ts:74` registers an event-name union rejected by the current `ExtensionAPI` overload, whose last overload accepts only `input`.

The same check reports the independently tracked [[projects/mlegls-pi/issues/archive/root-typecheck-obsidian-environment]] and [[projects/mlegls-pi/issues/archive/root-board-store-fixture-typecheck]] diagnostics. The focused board, session-meta (with inherited `PI_WM_PARENT_SESSION` unset), and supervision tests pass; the root typecheck remains red. No workaround was found for the two memory diagnostics, and none occurred in the changed files.

Hypothesis: the memory extension's test/content narrowing and event registration have drifted from the pinned pi API types. Decide whether to repair those types or give the memory extension a separate typecheck boundary.

From session:01a0f08f-a014-7757-a5c0-dfe1d53421d4: On 2026-09-30, `bunx tsc --noEmit --pretty false` exited 2 with 56 diagnostics. Existing issues cover the Obsidian extension environment ([[projects/mlegls-pi/issues/archive/root-typecheck-obsidian-environment]]) and the board fixture ([[projects/mlegls-pi/issues/archive/root-board-store-fixture-typecheck]]). This run also reported two distinct diagnostics in the memory extension:

- `extensions/memory/images.test.ts:13:39`: `text` does not exist on the image/content union.
- `extensions/memory/index.ts:74:9`: the session-event union is not accepted by the selected `on` overload.

Those files were unchanged. No baseline comparison or repair was made; the filtered output contained no diagnostics in `lib/outliner.ts` or `lib/vault.ts`.

disposition, 2026-09-30: fixed in 18ebcde (the `images.test.ts:13` union read; `index.ts:74` no longer reported). Root tsc is clean. The three memory-typecheck observations were duplicates.
