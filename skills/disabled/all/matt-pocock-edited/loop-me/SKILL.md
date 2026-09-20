---
name: loop-me
description: "Use when asked to design a workflow in the current workspace."
disable-model-invocation: true
argument-hint: "A workflow to design, or nothing to go find one"
---

Run a stateful `/grilling` session whose only output is **workflow** specs. Create, edit, and delete specs as the grilling resolves things.

A **loop** is a recurring pattern in the user's life; seeing life as loops within loops reveals what's predictable enough to **delegate**. Use the lens to find loops worth specifying, and propose ones the user hasn't noticed. A **workflow** is the spec of one loop, in `workflows/*.md` — the source of truth.

Vocabulary, reached for only when a workflow calls for it — **mandate nothing structural** (no AI, checkpoint, or schedule unless the grilling shows it's needed):

- **Trigger**: event (usually more efficient) or schedule.
- **Checkpoint**: a human-in-the-loop verify/decide point.
- **Push right**: defer the checkpoint — maximal work before the human is asked, once, late, with everything prepared.
- **Brief**: what a checkpoint presents — a tight, decision-ready summary linking down to the asset, never the raw output.

A spec is done when an implementer agent could build it without asking a single question. Grill until then.

`NOTES.md`: raw notes on the user's world, tools, channels, and their terminology. When empty or thin, interview them about their world before specifying anything; sharpen fuzzy terms into canonical ones as they surface and record them here.
