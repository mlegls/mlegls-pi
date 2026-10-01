---
name: profile
description: "Use to find where sessions spent wall time and money."
---

`bun ~/dev/mlegls-pi/lib/profile.ts [SESSION] [--json]` profiles a session and the tree it spawned (default this session). `--project P --last N` lists recent root sessions as a baseline. `bun ~/dev/mlegls-pi/lib/timeline.ts [SESSION]` writes the tree as an HTML timeline, with my turns across all sessions on top; `open` it for me.

rank the biggest costs against the baseline and name each as muda. only the critical path buys wall time (amdahl).

propose fixes in scaffolding: model/effort routing per agent, parallelism, context hygiene, tools that replace repeated motion.
