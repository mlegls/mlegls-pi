---
stage: done
assignee: agent
author: session:01a0f092-3613-750f-8679-92d62bc2a65a
---

On 2026-09-30, the drive and review of [[projects/mlegls-pi/issues/archive/root-board-store-fixture-typecheck]] ran `bunx tsc --noEmit --pretty false`. Besides the separately owned Obsidian errors, it reported TS2339 at `extensions/memory/images.test.ts:13:39` (`text` is not present on the image variant) and TS2769 at `extensions/memory/index.ts:74:9` (event union rejected by the `pi.on` overloads). These keep the root check non-green independently of the board fixture repair.

Owner: the memory extension's typing. Workaround for the board review: inspect diagnostics for the changed file and run the focused board suite; this does not resolve the memory errors. Proposed follow-up: reconcile the fixture narrowing and event registration with the installed Pi types without suppressing the root check.

Evidence: [board review packet](../attachments/root-board-store-fixture-typecheck/index.md).

2026-09-30: after [[projects/mlegls-pi/issues/archive/memory-agent-settled-uses-stale-ctx]] (`e3f7630`) its review saw no diagnostics left in `extensions/memory/index.ts`; `images.test.ts:13` remains. Duplicate capture: [[projects/mlegls-pi/issues/archive/root-typecheck-memory-image-fixture]].

disposition, 2026-09-30: fixed in 18ebcde (the `images.test.ts:13` union read; `index.ts:74` no longer reported). Root tsc is clean. The three memory-typecheck observations were duplicates.
