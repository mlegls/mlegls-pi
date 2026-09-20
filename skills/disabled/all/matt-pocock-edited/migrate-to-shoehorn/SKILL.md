---
name: migrate-to-shoehorn
description: "Use when asked about shoehorn, replacing type assertions in tests, or partial test data."
---

Replace `as` assertions in **test code only** (never production) with `@total-typescript/shoehorn`, which passes partial data while keeping TypeScript happy:

| Pattern | Replacement |
| --- | --- |
| `as Type` / hand-faked full objects | `fromPartial({...})` — partial data that still type-checks |
| `as unknown as Type` (intentionally wrong data) | `fromAny({...})` — keeps autocomplete |
| force a full object (swap to fromPartial later) | `fromExact({...})` |

Workflow:

1. Ask which test files have problematic `as` assertions, whether large objects with few relevant properties are involved, and whether intentionally-wrong data is needed for error tests.
2. `npm i @total-typescript/shoehorn`; find candidates with `grep -r " as [A-Z]" --include="*.test.ts" --include="*.spec.ts"`; apply the replacements with imports from `@total-typescript/shoehorn`; run the type check.
