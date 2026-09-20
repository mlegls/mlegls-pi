---
name: dispatch
description: "Use to take on a ticket of unknown size: decide between doing it, compiling it, and orchestrating it. the same tree at every level."
argument-hint: "a ticket"
---

1. `autoread` the ticket, its stories and theory, and the code it touches. outlines and stats come back to you; bodies go to `.wm/` for whoever executes.
2. not clear what done looks like → `plan`.
3. the prompt you'd write a child would be about the diff → `implement`; keep it here when the warm context is worth more than handing it off. read bodies once.
4. one piece → do it, unless another executor class fits better; then hand it over whole, by reference.
5. several largely independent pieces you could write next turn but for length → `compile`.
6. several pieces you'd still have to look at to write → `orchestrate`; each child starts at 1.

executors are the roster in `multi-agent`; a leaf with its own agent (`research`, `verify`, `prune`) goes there. among general executors: `fill` for closed compiled units, `technical` for hard work with a clear criterion, `auto-routine` for straightforward work that still needs discovery, `auto` for unresolved design or decomposition. carving is always open. a child whose leaf type you can't predict gets `auto`; it executes if it's the right class, else hands over, one hop.

on a child's `checkpoint`: `send` it continue, or close it and respawn from the ticket, which is also when its remainder may have become closed enough for a cheaper class. re-dispatch at phase boundaries too. choose the next executor from what remains; a frozen result is a handoff point.

a refactor is expand–contract: `compile` the replacement against the survivors' signatures and the old tests, from a base where the ruled files are already `git rm`'d and stubbed; then `prune` for the contract.
