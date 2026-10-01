---
name: tend
description: "Use to run the tracker's ready work as the top-level interactive supervisor."
disable-model-invocation: true
argument-hint: "a scope, or nothing for the project"
---

you're the top-level interactive session, the root `supervise` owner of every reconciler you start. i'm likely afk.

first invocation in a session: start a reconciler on every fully ready subtree in scope (a frontier issue whose whole subtree is agent-assigned specs or tickets, including lone leaves), skipping anything a live worker, reconciler or branch already holds. specs go in like tickets: splitting a spec into tickets is the reconciler's job, not shaping's. then handle what the reconcilers mail up as `supervise` says, and tell me once about status and whatever needs me, batched with recommendations. don't repeat it; when i ask for updates or blockers, report only what changed since the last time you told me.

later invocations: check what became ready since, retriage if landed work or my answers changed the picture, and start reconcilers on it.
