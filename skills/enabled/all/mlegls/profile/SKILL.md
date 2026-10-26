---
name: profile
description: "Use to find where sessions spent wall time and money."
---

`bun ~/dev/mlegls-pi/lib/profile.ts [SESSION] [--json]` profiles a session (an id, a unique fragment, or a bb `thr_…` thread id) and the tree it spawned (default this session). `--project P --last N` lists recent root sessions as a baseline. For an audit, use `--project P --since T --until T --by-thread --host beelink --evidence DIR`: root-session trees grouped by BB thread, windowed costs, all rows unless `--last N` is explicit. Repeat `--host` for more SSH aliases; each needs non-interactive SSH and `bun` on its login PATH, not an updated checkout. The evidence directory contains grouped root trees, exclusive per-thread and per-session JSON, user prompts with BB thread/message references, and tool-time totals. Costs belong to completed entries in the inclusive window; active intervals are clipped to it. Non-BB rows retain their session IDs. A long-lived supervisor's wave is `--run SLUG` (one reconciler run) or `--since T --until T`. `ab timeline [SESSION]` opens the tree as an HTML timeline for me, with my turns across all sessions on top; clicking a lane shows its context as a bento of cells by purpose, in the window at a given call or as token × calls held. `bun ~/dev/mlegls-pi/lib/context.ts [SESSION]` prints the same purpose totals. Held tokens are cache reads: big early cells held all session are where context costs money.

rank the biggest costs against the baseline and name each as muda. only the critical path buys wall time (amdahl).

propose fixes in scaffolding: model/effort routing per agent, parallelism, context hygiene, tools that replace repeated motion.
