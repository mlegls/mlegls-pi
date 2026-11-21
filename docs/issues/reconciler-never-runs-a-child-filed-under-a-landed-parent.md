---
stage: "ticket"
assignee: "agent:auto-routine"
author: "session:thr_ts3gpc75tx"
priority: 2
---
A worker filed an open child under a parent that had already landed in its tree's collector, and the reconciler never scheduled it: it doesn't run children of a landed node. Siblings blocked on that child left nothing on the frontier, so the run stopped with open work.

Observed in concept on 2026-11-10: [[projects/concept/issues/bound-resident-review-card-pages-during-import]] was filed under `bound-import-deck-reads-and-review-consumers` after that parent landed into the `make-large-card-imports-scale-in-one-tutor-script` collector (03:11 UTC). Both the Theory drain and the 5,000-card re-drive were blocked on it, and the reconciler reported "stopped with open work". The supervisor moved the ticket directly under the root (concept `33ef95e46`) and restarted it (@thread:thr_ihbpyrp6s2#msg=25506).

Same class as [[projects/mlegls-pi/issues/reconciler-never-reenters-a-reopened-landed-node]] (a reopened landed node) and [[projects/mlegls-pi/issues/reconciler-stalls-on-idea-children-filed-by-workers]] (idea children), but here the parent never reopened and the child was a ready ticket.

Either option fits the existing fixes: treat a landed node that gains an open child as reopened (schedule the child, then re-join), or have the reconciler reparent such a child to the nearest unlanded ancestor itself, as the idea-children fix moves ideas out, and tell the owner.