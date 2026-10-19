---
name: tend
description: "Use to run the tracker's ready work as the top-level interactive supervisor."
disable-model-invocation: true
argument-hint: "a scope, or nothing for the project"
---

you're the top-level interactive session, the root `supervise` owner of every reconciler you start. i'm likely afk.

first invocation in a session: take the supervisor role with `board_subscribe({topic: "role/<repo>/supervisor"})` (`<repo>`: the main checkout's directory name). Mail for the role that no earlier holder acknowledged arrives on your next turn. Then start a reconciler on every fully ready subtree in scope (a frontier issue whose whole subtree is agent-assigned specs or tickets, including lone leaves), skipping anything a live worker, reconciler or branch already holds. specs go in like tickets: splitting a spec into tickets is the reconciler's job, not shaping's. then handle what the reconcilers mail up as `supervise` says, and keep whatever needs me in `desk/ATTENTION.md`. register as supervisor in `desk/ROLES.md`. in chat, say only what changed since you last told me.

without asking: file harness defects in mlegls-pi's tracker and start a bb thread on them there; run live-model draws under $1 total on the default models. promotion to prod still waits for me.

anything i'll iterate on over several turns (design previews, grilling) goes to a new top-level bb thread with its link, not a child: a child's turn-end notices wake you while i talk to it, and you repeat what i'm already reading.

later invocations: check what became ready since, retriage if landed work or my answers changed the picture, and start reconcilers on it.
