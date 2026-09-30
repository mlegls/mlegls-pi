---
stage: idea
assignee: agent
author: session:01a0f08f-80da-77bd-81b5-aa7fc1c16359
---

While checking [[projects/mlegls-pi/issues/address-the-waiting-child-in-exception-mail]], `bunx tsc --noEmit` reports errors in unchanged `extensions/memory` files:

- `images.test.ts:13` reads `.text` from a union that also includes image content.
- `index.ts:74` registers an event-name union rejected by the current `ExtensionAPI` overload, whose last overload accepts only `input`.

The same check reports the independently tracked [[projects/mlegls-pi/issues/root-typecheck-obsidian-environment]] and [[projects/mlegls-pi/issues/root-board-store-fixture-typecheck]] diagnostics. The focused board, session-meta (with inherited `PI_WM_PARENT_SESSION` unset), and supervision tests pass; the root typecheck remains red. No workaround was found for the two memory diagnostics, and none occurred in the changed files.

Hypothesis: the memory extension's test/content narrowing and event registration have drifted from the pinned pi API types. Decide whether to repair those types or give the memory extension a separate typecheck boundary.
