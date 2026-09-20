---
name: evaluate-lints
description: "Use when running lints or interpreting their output."
---

# Evaluate Lints

Goodhart. Treat lint output as evidence for its mapped principle, not a target.

| Lint | Principle | No | Yes |
|---|---|---|---|
| `complexity`, `max-depth`, `max-lines-per-function`; clippy `cognitive_complexity`, `excessive_nesting`, `too_many_lines`; `gocognit`, `nestif`, `funlen` | laziness protocol, minimize reader load, model the domain | extract `handleA()`…`handleD()`, each called once | `const handlers: Record<Kind, Handler>`; delete the speculative case |
| `no-unnecessary-condition`; staticcheck `S1*` | boundary discipline | widen the type | delete the check; if it guards a real case, fix the type at the boundary |
| `no-explicit-any`, `consistent-type-assertions`, `no-non-null-assertion`; clippy `unwrap_used`, `expect_used`; `forcetypeassert` | type-system discipline | `unknown` then cast; `!` → `?? throw` | parse at the boundary; a type that can't hold the state |
| knip, `dead_code`, `unused`, machete, `deadcode` | migrate callers then delete | keep both | migrate and delete in the same commit |
| `oxc/no-barrel-file` | deletion test | keep the hub, re-export more | delete the barrel; import source modules directly |

Instruments (manual, never gates): `depcruise` dependent-count rules approximate the deletion test — a single-dependent module is a candidate to inline, not a violation; a new module legitimately starts with one dependent.

If the needle will not move without cheating, the instrument has found design work: carry the signal back to the representation or spec instead of suppressing it or teaching the code to duck.
