---
stage: done
assignee: agent
author: session:01a0cd1a-8da4-701c-8253-d1ab9fd2b4e6
part-of: "[[projects/mlegls-pi/issues/scripted-supervision-loop]]"
---

`ab daemon`: one long-running process per user that hosts jobs outlasting any exec kernel or session. First job type is a supervision loop; others will want it too, so jobs are a small registry, not supervision-specific.

- started on demand by the first command that needs it; `ab daemon status` lists jobs.
- each job persists its state to a file it owns (for supervision, in the owning worktree) and resumes from it after a daemon restart, re-attaching to native state by ID. No other durability.
- commands talk to it over a local socket under `AB_STATE`.

first use: start a trivial job from an exec cell, reset the kernel, kill and restart the daemon, see the job resume and `status` report it.
