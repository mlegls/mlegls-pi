---
name: plan
description: "Use for implementation-level planning: from the want, derive the affordance sequence and its steps through grilling, and record a spec implement can code from."
argument-hint: "a bounded goal whose destination is agreed"
---

1. Start from the want, in the user's words. Use `grilling` to derive the
   sequence(s) of affordances that fulfil it and the program steps each
   decomposes into, over the theory's tree. If they come naturally there
   may be nothing to build. What cannot be written is what the spec adds.
   What is very hard to write means the theory is wrong or the story is not
   worth supporting; settle that here, not by forcing it.
2. Settle the shape of what is added. A step that cannot be called in one
   line is a missing verb; name it. The steps block is the future test
   names (`testing`); `simplify` writes them. Sketch the program with `show-me` when the
   shape has choices worth seeing.
3. Record it (`tracker`): the want, the sequence, the steps, the shape;
   `next: implement`. Split into child issues when the work exceeds a session
   or has parts to parallelize.
4. Return the issue and the recommended continuation: `implement` for one
   session, `orchestrate` for more, `compile` when the children's inputs are closed.
