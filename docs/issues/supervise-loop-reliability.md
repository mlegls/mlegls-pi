---
stage: spec
assignee: agent
priority: 2
author: session:01a0f065-abaf-776c-bc8b-419cb9b312e4
---

Superseded 2026-10-01 by [[projects/mlegls-pi/issues/reconcile-the-execution-tree-with-lazy-exception-handlers]].

Make `ab supervise` notice and recover from the failures that cost hours in the 2026-09-30 tend session and the Concept campaigns: dead workers that look alive, constraints that arrive a turn late, workers poisoning their own context with images, stopped jobs that can't be cleaned up, peers missing base-topic decisions, and integrate failures reported as a bare conflict. Each child states its own contract. Several touch `lib/jobs/supervise.ts` and `ab/main.ts`, so they are ordered with `blocked-by` to avoid merge churn, not because of a logical dependency.

Done when every child is done and the loop has been used on a real supervised ticket after the changes landed (the daemon must be restarted to load them).
