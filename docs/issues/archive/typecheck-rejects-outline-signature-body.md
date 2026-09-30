---
stage: done
assignee: agent
author: session:run:run_00e131a4d024
---

## Result

Fulfilled by `b1c3574`: `lib/outline-read/program.ts` checks `"body" in st` before accessing the optional body. The installed TypeScript is 5.9.3. Separate root-check failures remain separately owned; no whole-repository pass is claimed here.

While checking the tracker lifecycle/routing migration on 2026-09-22, `bunx tsc --noEmit` reports TS2339 at `lib/outline-read/program.ts:135`: `body` does not exist on `SignatureDeclaration` (a `CallSignatureDeclaration` has no body). This remained after the changed routing/view test files typechecked.

Reproduce against the current installed TypeScript types before choosing a repair. The separate missing-TypeScript dependency and consequent lint extractor errors are already [[projects/mlegls-pi/issues/archive/lint-typescript-dependency]]. Library regressions passed; that does not establish a clean global typecheck.
