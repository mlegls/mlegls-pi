---
stage: "idea"
assignee: "agent"
priority: 2
author: "session:01a20657-0e8d-726c-98b9-a4f79a5a23fc"
---
Found in the 2026-11-23 audit of the supervision/issue orchestration system (@thread:thr_3pkhxrd57p).

> [bb-plugins/supervision/server.ts:61-66](../../../bb-plugins/supervision/server.ts) injects all 11 supervision tools (including 350-word descriptions of `reconcile_resolve` and `pickup`) into **every BB thread with a checkout**, including leaf `verify` / `auto-routine` / `reviewer` workers that should never touch them.

`bb.agents.configure` gets `thread.parentThreadId` and the thread's `pluginMetadata`, so workers spawned through the plugin's `workerSpawn` could be tagged at spawn and given only the tools their role uses. Open: which roles call which tools (supervisors, `manager`, exception handlers resolving through `reconcile_resolve`?), and whether a tool catalog change needs a fresh provider session to take effect.
