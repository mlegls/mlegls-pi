---
name: profile
description: "Use to find where sessions spent wall time and money."
---

`bun ~/dev/mlegls-pi/lib/profile.ts [SESSION] [--json]` profiles a session and the tree it spawned (default this session). `--project P --last N` lists recent root sessions as a baseline. A long-lived supervisor's wave is `--run SLUG` (one reconciler run) or `--since T --until T`. `ab timeline [SESSION]` opens the tree as an HTML timeline for me, with my turns across all sessions on top; clicking a lane shows its context as a bento of cells by purpose, in the window at a given call or as token × calls held. `bun ~/dev/mlegls-pi/lib/context.ts [SESSION]` prints the same purpose totals. Held tokens are cache reads: big early cells held all session are where context costs money.

rank the biggest costs against the baseline and name each as muda. only the critical path buys wall time (amdahl).

propose fixes in scaffolding: model/effort routing per agent, parallelism, context hygiene, tools that replace repeated motion.
