---
name: to-tickets
description: "Use when asked to break a spec, plan, or conversation into implementation tickets."
disable-model-invocation: true
---

Tickets divide work across contexts. The result is a dependency graph whose
nodes are independently verifiable changes, not a file-by-file checklist.

1. Read the spec and its discussion, relevant stories and theory, and the code
   around the proposed seams.
2. Find the useful cuts. Prefer a behavior carried through its full path. A
   shared shape change or prefactor comes first only when the other work
   actually depends on it. An indivisible change can remain one ticket.
3. Give each ticket its deliverable, slice of Shape, stories and proposed
   evidence, or preserved invariants for a refactor. Include the reason for
   the shape and the unresolved questions this ticket will answer.
4. Present the graph and proposed ticket contents for confirmation (`grilling`).
   Once approved, publish blockers first so edges can refer to real items.

The project tracker docs define storage, ownership, and blocking relations.
Link the parent spec rather than duplicating it. Each ticket needs enough
context to be worked fresh; it does not need to reproduce the whole spec.

Readiness and blocking are distinct. A fully specified ticket can still await
a dependency. Compatibility scaffolding between tickets earns its place only
from a real consumer promise, not from the ticket sequence itself.
