# Repair landing through red checks — drive

## Setup and predictions (before first use)

- Revision: 8233809f186e28b8555e7c708da7560432e3b0bb, clean driver checkout; local-library deployment inherited from implementer target red-main-holds-the-repair-for-a-check-failure-implement-1. Execution is in this driver's own checkout. Bun 1.4.4 is available. No authentication, seed, server, ports or external services required.
- Entry point: import `heldByRed` from `./lib/reconcile/checks.ts` with `bun -e` and call its public library surface. Import success will establish readiness.
- Prediction 1: a lint diagnostic `packages/web/src/ui/materials/quiz/run.tsx:429:47: error lint:design` allows a landing touching that file (`false`) and holds an unrelated code landing (`true`).
- Prediction 2: the equivalent TypeScript diagnostic `packages/web/src/ui/materials/quiz/run.tsx(429,47): error TS2322: Type mismatch` yields the same decisions.
- Prediction 3: the existing browser diagnostic `[chromium] › packages/web/src/ui/materials/quiz/run.tsx:429:47` retains the same behavior.

## Encounter

Import succeeded immediately (exit 0), establishing library readiness. Called the function with each diagnostic and two candidate landings. All three returned `repairHeld: false` and `unrelatedHeld: true`.

| Story / expectation | Outcome | Observation |
| --- | --- | --- |
| Lint repair gets through red; unrelated change remains held | held / met | false / true |
| TypeScript repair gets through red; unrelated change remains held | held / met | false / true |
| Existing browser diagnostic retains its repair exception | held / met | false / true |

## Replayable checks

Run in the tested checkout:

```sh
bun -e 'import { heldByRed } from "./lib/reconcile/checks.ts"; const p = "packages/web/src/ui/materials/quiz/run.tsx"; for (const [name, diagnostic] of [["lint", `${p}:429:47: error lint:design`], ["tsc", `${p}(429,47): error TS2322: Type mismatch`], ["browser", `[chromium] › ${p}:429:47`]]) { console.log(JSON.stringify({name, diagnostic, repairHeld: heldByRed(diagnostic, [p]), unrelatedHeld: heldByRed(diagnostic, ["lib/unrelated.ts"])})); }'
```

Accept each of the three labeled records only with `repairHeld: false` and `unrelatedHeld: true`. This directly exercises the library surface identified by the ticket, not a full live reconciler/main-red deployment.

## Frictions and limits

No usage friction encountered. No source, test or fixture inspection, repository checks, or product repairs performed. No visual journey; screenshots not applicable. No servers or other persistent resources started. The checkout-owned invocation replaces the implementer checkout as instructed; no inherited deployment selectors were used.

