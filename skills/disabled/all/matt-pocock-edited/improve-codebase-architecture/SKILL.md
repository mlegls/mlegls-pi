---
name: improve-codebase-architecture
description: "Use when asked to find architectural improvements or opportunities to deepen modules."
disable-model-invocation: true
---

Surface architectural friction and propose **deepening opportunities**: refactors that turn shallow modules into deep ones, for testability and AI-navigability. Invoke the `codebase-design` skill and use its vocabulary exactly (module, interface, depth, seam, adapter, leverage, locality — never "component"/"service"/"API"/"boundary"). `CONTEXT.md` names the domain; ADRs in `docs/adr/` record decisions not to re-litigate.

## 1. Explore

Scope before scanning (YAGNI): if the user named a direction, take it; otherwise walk the commit history for hot spots and weight recently-changed areas — widen only if changes are scattered. Read `CONTEXT.md` and nearby ADRs first, then spawn a sub-agent to walk the codebase organically, noting friction: bouncing between many small modules to understand one concept, shallow modules, pure functions extracted for testability while the bugs hide in how they're called (no locality), seam leaks, untested or hard-to-test areas. Apply the **deletion test** to suspected shallowness: "yes, deleting it concentrates complexity" is the signal.

## 2. Present candidates as an HTML report

Write a self-contained HTML file to `<tmpdir>/architecture-review-<timestamp>.html` (`$TMPDIR` → `/tmp` → `%TEMP%`), open it for the user, and tell them the absolute path. Tailwind via CDN; Mermaid via CDN for graph-shaped relationships, hand-built divs/SVG for editorial visuals. Each candidate is a card: **Files**, **Problem**, **Solution**, **Benefits** (in terms of locality, leverage, tests), **Before/After diagram** (side by side, showing the shallowness and the deepening), **Recommendation strength** badge (`Strong` / `Worth exploring` / `Speculative`). End with a **Top recommendation** section. See [HTML-REPORT.md](HTML-REPORT.md) for the scaffold and styling.

Use `CONTEXT.md` vocabulary for the domain ("the Order intake module", not "the FooBarHandler"). Surface an ADR-contradicting candidate only when the friction warrants reopening the ADR, marked with a warning callout; don't list every refactor an ADR forbids.

Do NOT propose interfaces yet. Ask: "Which of these would you like to explore?"

## 3. Grilling loop

On a pick, invoke the `grilling` skill to walk the decision tree (constraints, dependencies, the deepened module's shape, what sits behind the seam, what tests survive). Side effects happen inline via the "domain-modeling" skill:

- New or sharpened term → update `CONTEXT.md` right there (create lazily).
- Candidate rejected for a load-bearing reason → offer an ADR ("so future reviews don't re-suggest it") — only when a future explorer would need it; skip ephemeral or self-evident reasons.
- Exploring alternative interfaces, or executing a picked candidate → the `architect` skill (design-it-twice as a procedure), with the scan and grilling output as its Phase A grounding; it stops at the design package, then `implement` against it.

## Principles

Scoring candidates: bias to deletion and the smallest change; friction evidence is layers between question and answer (the `evaluate-lints` skill's weighing rules, and lint counts if the project has gates).

Executing a pick: subtract before deepening, re-spec when a deepening net-adds lines or sprouts adapters, redesign when the friction came from a bolted-on requirement, migrate callers then delete when a new interface appears, converge on the end state across phases.
