---
stage: done
assignee: agent
author: session:01a0f62b-c611-7b38-b9c1-36fdc421abb2
---

"stopped with open work: X (spec)" (`lib/reconcile/reconcile.ts` tellOwner) does not say why nothing is frontier, so the owner has to read the collector's tracker to find the cause. Both stops in arkhai-payments (2026-10-05, 2026-10-07) were tracker-shape problems: [[projects/mlegls-pi/issues/reconciler-stalls-on-idea-children-filed-by-workers]] and [[projects/mlegls-pi/issues/tree-collector-does-not-see-blockers-resolved-on-main]]. The stop message should name, for each open non-frontier node, what holds it: an idea-stage child, an open blocker (and where it is resolved, if anywhere), or a pending exception.

## Result

The walk records why each node it couldn't start is held, and the stop message lists them one per line (3d0689b): effective stage and the idea/goal descendants that lower it, each blocker with where it stands (open; done in the owner's checkout but open in this branch; absent from this branch), claims, non-agent assignees, priority-4 deferral, or parked behind a blocker. A pending exception never reaches the stop message, since the run doesn't stop while one is open. Seen on a scratch tracker: `stopped with open work: - a: blocked by x (open)`.
