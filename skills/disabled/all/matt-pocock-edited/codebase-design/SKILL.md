---
name: codebase-design
description: "Use when designing module interfaces, boundaries, or seams for testing."
---

Design **deep modules**: a lot of behaviour behind a small interface at a clean seam, testable through that interface — leverage for callers, locality for maintainers.

## Glossary

Use these terms exactly; consistent language is the whole point.

- **Module**: anything with an interface and an implementation — deliberately scale-agnostic (function, class, package, tier-spanning slice). _Avoid_: unit, component, service.
- **Interface**: everything a caller must know to use the module correctly — types, but also invariants, ordering, error modes, required config, performance. _Avoid_: API, signature (type-level only).
- **Implementation**: a module's body. Distinct from adapter: a small adapter can have a large implementation (a Postgres repo) and vice versa (an in-memory fake).
- **Depth**: leverage at the interface — behaviour exercised per unit of interface learned. Deep = lots behind little; shallow = interface nearly as complex as the implementation.
- **Seam** _(Michael Feathers)_: where you can alter behaviour without editing in that place; where a module's interface lives. Placing the seam is its own decision, distinct from what goes behind it. _Avoid_: boundary (collides with DDD's bounded context).
- **Adapter**: a concrete thing satisfying an interface at a seam — a role, not a substance.
- **Leverage**: what callers get from depth; one implementation pays back across N call sites and M tests.
- **Locality**: what maintainers get; change, bugs, knowledge, and verification concentrate in one place.

## Principles

- **Depth is a property of the interface, not the implementation.** A deep module can be internally composed of small swappable parts with **internal seams** (private, used by its own tests) besides the external one.
- **The deletion test**: delete the module in imagination — complexity vanishing means pass-through; complexity reappearing across N callers means it earned its keep.
- **The interface is the test surface.** Wanting to test *past* it means the module is probably the wrong shape.
- **One adapter means a hypothetical seam; two means a real one.** Don't introduce a seam unless something varies across it.
- When designing an interface: fewer methods, simpler params, more complexity hidden inside. Accept dependencies rather than creating them; return results rather than producing side effects.

## Rejected framings

- Depth as implementation-lines / interface-lines (Ousterhout): rewards padding. Depth-as-leverage instead.
- "Interface" as the TS `interface` keyword or public methods: too narrow.
- "Boundary": say seam or interface.

## Going deeper

- Deepening a cluster given its dependencies — [DEEPENING.md](DEEPENING.md): dependency categories, seam discipline, replace-don't-layer testing.
- Exploring alternative interfaces — [DESIGN-IT-TWICE.md](DESIGN-IT-TWICE.md): parallel sub-agents design it several radically different ways, compared on depth, locality, seam placement.
- The full design-before-code procedure — the `architect` skill: ground, fan out candidate sketches, screen and compare on these axes, implement against the synthesis.
