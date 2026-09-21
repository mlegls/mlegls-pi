---
name: plan
description: "Use for implementation-level planning: from the want, derive the affordance sequence and its steps through grilling, and record a spec implement can code from."
argument-hint: "a bounded goal whose destination is agreed"
---

1. Start from the want, in the user's words. Use `grill` to derive the
   sequence(s) of affordances that fulfil it and the program steps each
   decomposes into, over the theory's tree. If they come naturally there
   may be nothing to build. What cannot be written is what the spec adds.
   What is very hard to write means the theory is wrong or the story is not
   worth supporting; settle that here, not by forcing it.
2. Settle the shape of what is added. A step that cannot be called in one
   line is a missing verb; name it. The steps block is the future test
   names (`testing`); `simplify` writes them. Sketch the program with `show-me` when the
   shape has choices worth seeing.
3. Settle shared interfaces and consequential implementation choices. Split
   into independently implementable contracts where useful. Record each leaf's
   ownership, dependencies, observable acceptance, and any discovery or design
   deliberately delegated to its worker. Unresolved choices outside that
   authority remain holes.
4. Create or update the durable stories (`project-docs`) with their wants, affordance sequences and observable acceptance; refactors may cite existing stories they preserve. Link them from the issues so verification starts from the agreed behavior. Record it (`tracker`): the want, the sequence, the steps, the shape;
   `next: implement` when the remaining work is within the delegated authority.
   Reference named code and docs for context already recorded there.
5. Return the issue and what remains before execution: `compile` to prepare
   closed assignments, `implement` for a bounded autonomous session, or
   `supervise` to carry the scope through execution and verification.
