---
name: advance
description: "Use to find the next session-sized chunk of recorded work, in one issue's subtree or the whole tracker."
disable-model-invocation: true
argument-hint: "an issue slug, or nothing for the whole tracker"
---

1. `tracker`'s `issues.ts tree [slug]`, then `mine [slug]` and `frontier [slug]`. that's the state; read the issues it points at, not the whole tree.
2. find a tracer bullet: one session, one concrete result (a decision, a research answer, a prototype, a plan, an implementation increment). it can cross issues or cover part of one.
3. propose it: why it's the highest-leverage move now, which skill carries it (`map`, `plan`, `verify-story` for what's mine; `realize` for the frontier), what ends the session. the frontier runs alongside: say what to dispatch while the mine move happens. if `next` or `blocked-by` on the issues you read is wrong, say so; fixing it is part of the move.

an idea with no record is `introduce`.
