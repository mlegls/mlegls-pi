---
stage: done
author: session:01a0f08f-a344-71a4-9a54-6684c159b38b
---

While implementing [[projects/mlegls-pi/issues/memory-agent-settled-uses-stale-ctx]] on 2026-09-30, `./node_modules/.bin/tsc --noEmit` reports TS2339 at `extensions/memory/images.test.ts:13`: a message content union includes image content without a `text` field. The test is unchanged; `bun test extensions/memory` passes (15 tests). The root check also reports separately tracked [[projects/mlegls-pi/issues/root-board-store-fixture-typecheck]] and [[projects/mlegls-pi/issues/root-typecheck-obsidian-environment]] diagnostics. Replacing the memory event-name union registration with literal subscriptions removed its own TypeScript overload diagnostic. The focused memory tests are the available workaround; the root typecheck still exits nonzero.

Review reproduced these root diagnostics after adding the lifecycle replay; no diagnostics remain in `extensions/memory/index.ts` or `extensions/memory/lifecycle.test.ts`. `ab check -- bun test extensions/memory` now passes 20 tests. The focused suite remains the workaround; this unrelated fixture narrowing repair is still deferred.

disposition, 2026-09-30: duplicate of [[projects/mlegls-pi/issues/root-typecheck-memory-diagnostics]], filed in parallel; this ticket's evidence stands there.
