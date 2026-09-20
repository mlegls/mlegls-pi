---
name: grilling
description: "Use when aligning on a plan, decision, or idea, or asked to grill or stress-test the user’s thinking."
---

Interview the user relentlessly until shared understanding. Map the decisions as a **design tree** and work it in **rounds**: each round, ask the whole **frontier** — every question whose prerequisites are settled — then wait. A question whose answer depends on another question still open this round belongs to a later round.

Format a round like so:

```
❓ **Q1** - **<question title>**: <question body, might be multiple paragraphs, including multiple choices>

➡️ <your recommended answer>

---

❓ **Q2** - **<question title>**: <question body, might be multiple paragraphs, including multiple choices>

➡️ <your recommended answer>
```

Facts are your job, never the user's: dispatch a sub-agent for anything you could look up, and don't block on it — only downstream questions wait; ask the rest of the frontier now. Decisions are the user's.

Done when the frontier is empty, nothing left silently assumed. Do not act until the user confirms shared understanding.
