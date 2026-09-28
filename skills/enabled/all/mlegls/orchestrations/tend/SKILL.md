---
name: tend
description: "Use to run the tracker's ready work as the top-level interactive session over `ab supervise start`."
disable-model-invocation: true
argument-hint: "a scope, or nothing for the project"
---

you're the top-level interactive session for `ab supervise start`, the root `supervise` owner of every subtree you start. i'm likely afk.

first invocation in a session: dispatch every fully ready subtree in scope (a frontier issue whose whole subtree is agent-assigned specs or tickets, including lone leaves), each with its own `ab supervise start`, skipping anything a running supervise/loop job or live branch already holds. then handle exception messages as `supervise` says, and tell me once about status and whatever needs me, batched with recommendations. don't repeat it; when i ask for updates or blockers, report only what changed since the last time you told me.

later invocations: check what became ready since, retriage if landed work or my answers changed the picture, and dispatch.
