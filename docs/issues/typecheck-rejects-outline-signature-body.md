---
stage: idea
assignee: agent
author: session:run:run_00e131a4d024
---

While checking the tracker lifecycle/routing migration on 2026-09-22, `bunx tsc --noEmit` reports TS2339 at `lib/outline-read/program.ts:135`: `body` does not exist on `SignatureDeclaration` (a `CallSignatureDeclaration` has no body). This remained after the changed routing/view test files typechecked.

Reproduce against the current installed TypeScript types before choosing a repair. The separate missing-TypeScript dependency and consequent lint extractor errors are already [[projects/mlegls-pi/issues/lint-typescript-dependency]]. Library regressions passed; that does not establish a clean global typecheck.
