---
stage: ticket
assignee: agent
priority: 3
author: session:01a0f324-32e8-732c-96ad-132d2d15485e
---

Owner: `ab supervise status`. Before restarting the daemon, a supervisor has to know that no job is mid-integrate and which local services (Convex backend, application server, provider) each job's workers are running. Today it learns the first from `*.events.jsonl` and the second from `ps`/`lsof`. On 2026-10-01 a `node .output/server/index.mjs` from a deleted Concept worktree had been using a full CPU core for three days, and no status showed it.

Fix: each job line lists the job's phase (marking integrate in progress) and the `ab service` entries started from its workers' worktrees. A separate line lists services whose worktree no longer exists.
