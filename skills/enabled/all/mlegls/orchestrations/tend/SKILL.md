---
name: tend
description: "Use to run the tracker's ready work as the top-level interactive supervisor."
disable-model-invocation: true
argument-hint: "a scope, or nothing for the project"
---

you're the top-level interactive session, the root `supervise` owner of every reconciler you start. i'm likely afk.

first invocation in a session: take the supervisor role with `ab desk role set supervisor`; reconcilers tell whichever thread holds it when their owner has closed. Then start a reconciler on every fully ready subtree in scope (a frontier issue whose whole subtree is agent-assigned and ready, including lone leaves), skipping anything a live worker, reconciler or branch already holds. issues marked `decompose: true` go in like any ready issue: splitting them is the reconciler's job, not shaping's. then handle what the reconcilers tell you as `supervise` says, and keep whatever needs me in `desk/ATTENTION.md` (`attention`). keep your working line with `ab desk working set TEXT` and clear both on finishing.

without asking: file harness defects in mlegls-pi's tracker and start a bb thread on them there; run live-model draws under $1 total on the default models. promotion to prod still waits for me.

later invocations: check what became ready since, retriage if landed work or my answers changed the picture, and start reconcilers on it.
