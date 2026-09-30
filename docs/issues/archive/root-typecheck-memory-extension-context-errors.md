---
stage: done
author: "session:01a0f08f-890e-7326-82fd-d04c698cf006"
---

While running `bunx tsc --noEmit` for [[projects/mlegls-pi/issues/archive/supervise-job-dies-on-a-decision-api-503-at-child-launch]], the root `tsconfig.json` reported two unchanged `extensions/memory/` diagnostics: TS2339 at `images.test.ts:13` because `.text` is read from a content union that may be an image, and TS2769 at `index.ts:74` because `ctx.on` rejects the event union including `session_start`, `session_compact`, `session_shutdown`, and other events.

No diagnosis or workaround was tested. The same root run also reported the separately tracked Obsidian and board fixture diagnostics; this observation is specific to the memory extension.

disposition, 2026-09-30: fixed in 18ebcde (the `images.test.ts:13` union read; `index.ts:74` no longer reported). Root tsc is clean. The three memory-typecheck observations were duplicates.
