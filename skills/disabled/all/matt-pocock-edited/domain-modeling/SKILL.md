---
name: domain-modeling
description: "Use when discussing domain terminology or editing CONTEXT.md or ADRs."
---

The *active* discipline of changing the domain model — challenging terms, probing edge cases, writing glossary and decisions down as they crystallise. (Merely reading `CONTEXT.md` for vocabulary is not this skill.)

Layout: `CONTEXT.md` at the root plus `docs/adr/NNNN-slug.md`. A root `CONTEXT-MAP.md` means multiple contexts, each with its own `CONTEXT.md` and `docs/adr/` (root `docs/adr/` stays system-wide). Create files lazily — `CONTEXT.md` when the first term resolves, `docs/adr/` when the first ADR is needed.

During the session:

- **Challenge against the glossary**: "Your glossary defines 'cancellation' as X, but you seem to mean Y. Which is it?"
- **Sharpen fuzzy terms**: "You're saying 'account' — the Customer or the User?"
- **Stress-test relationships** with invented edge-case scenarios that force precise boundaries.
- **Cross-reference the code**: "Your code cancels entire Orders, but you just said partial cancellation is possible. Which is right?"
- **Update `CONTEXT.md` inline** the moment a term resolves — never batch. Format: [CONTEXT-FORMAT.md](./CONTEXT-FORMAT.md). `CONTEXT.md` is a glossary and nothing else: no implementation details, no spec, no scratchpad.
- **Offer ADRs sparingly** — only when all three hold: hard to reverse, surprising without context, and the result of a real trade-off. Format: [ADR-FORMAT.md](./ADR-FORMAT.md).

Code-level counterpart: a term that resolves here should be encoded in a structure in the code (state machine, table, union), not scattered conditionals.
