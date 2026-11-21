---
stage: "done"
assignee: "agent:auto-routine"
author: "session:thr_ts3gpc75tx"
priority: 2
---
A worker filed an open child under a parent that had already landed in its tree's collector, and the reconciler never scheduled it: it doesn't run children of a landed node. Siblings blocked on that child left nothing on the frontier, so the run stopped with open work.

Observed in concept on 2026-11-10: [[projects/concept/issues/bound-resident-review-card-pages-during-import]] was filed under `bound-import-deck-reads-and-review-consumers` after that parent landed into the `make-large-card-imports-scale-in-one-tutor-script` collector (03:11 UTC). Both the Theory drain and the 5,000-card re-drive were blocked on it, and the reconciler reported "stopped with open work". The supervisor moved the ticket directly under the root (concept `33ef95e46`) and restarted it (@thread:thr_ihbpyrp6s2#msg=25506).

Same class as [[projects/mlegls-pi/issues/reconciler-never-reenters-a-reopened-landed-node]] (a reopened landed node) and [[projects/mlegls-pi/issues/reconciler-stalls-on-idea-children-filed-by-workers]] (idea children), but here the parent never reopened and the child was a ready ticket.

Either option fits the existing fixes: treat a landed node that gains an open child as reopened (schedule the child, then re-join), or have the reconciler reparent such a child to the nearest unlanded ancestor itself, as the idea-children fix moves ideas out, and tell the owner.

## Result

done — Independent replay confirmed all three stories. The late child started from the original parent’s landing, the owner received the reparenting notice, and the sibling started from the late child’s landing. The original receipt stayed unchanged. Both existing scheduling tests passed; no code repair was needed.

```yaml
commit: 63816158
stories:
  - story: A late ready child under a landed parent is scheduled automatically.
    outcome: held
  - story: The owner is notified when the child is reparented.
    outcome: held
  - story: The blocked sibling starts after the late child lands.
    outcome: held
evidence:
  path: docs/attachments/reconciler-never-runs-a-child-filed-under-a-landed-parent/index.md
  visual: false
  shots: []
tests: []
filed: []
caveats:
  - The replay used simulated worker reports and stopped at sibling launch; it did not exercise final root completion.
```

Evidence: [docs/attachments/reconciler-never-runs-a-child-filed-under-a-landed-parent/index.md](../attachments/reconciler-never-runs-a-child-filed-under-a-landed-parent/index.md)
