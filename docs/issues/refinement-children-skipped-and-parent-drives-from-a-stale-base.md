---
stage: done
assignee: agent
priority: 1
author: "session:ca48dc62"
---

Observed 2026-10-17 in Common Concept (`bring-the-application-to-the-main-pages-design`): the parent's implement phase returned `done` as a refinement (commit `496d9830`) that filed five agent-ready child tickets (`use-the-canvas-document-columns-across-main-pages` and four siblings, each `part-of` the parent). The reconciler did not schedule the children; it launched the parent's drive (`…-drive-17`), which found no stories. Restarting the reconciler (reconcile_stop + reconcile) picked the children up correctly.

Two related losses on that path:
- the refinement commit `496d9830` (real code: page-frame.tsx, framing, ink actions) never reached the parent's collector (`tree/bring-the-application-to-the-main-pages-design`); a later child had to cherry-pick it.
- after a later child (`compare-the-remaining-main-page-frames-on-desktop-and-phone`) was moved out by a handler, the parent "resumed drive from the stopped run's branch …-drive-17 at 73121668", a stale base lacking every child landed since.

Done when: a refinement that creates children (a) lands its own commits into the collector, (b) is followed by scheduling those children before any parent drive, and (c) a parent resuming after a move-out starts from the collector head, not a stopped run's kept branch — each shown on a scripted reconcile scenario.

## Result

Cause: the parent's chain was a join (`self`: its earlier children had landed in `tree/<parent>`). It reported blocked with `respec`, and `respec` is ignored for joins, so the owner answered: file children and end as a refinement. The implement handler's "implementers don't decompose" check exempts joins, because in the destination's view the children already in the collector still look open. So a join's done always went on to drive: drive-17 started from implement-16's branch, which held 496d9830. Nothing landed that branch in the collector, and the walk only schedules children of a node with no chain. The stop's resume record then kept drive-17. Once the move-out left no open child, the reconciler checked that record only against the owner checkout, not the collector, and resumed drive from 73121668.

Fix (679583a9), in `lib/reconcile/reconcile.ts`:
- A join whose implementer reports done with open children in its collector's view now lands its commits in the collector (ab-parent set to `tree/<node>`, `integrate`) and ends its chain (`joinFiledChildren`). The walk then runs the children, and the join restarts from the collector after they land. If that landing fails, it is an exception.
- A resume record whose head lacks the node's collector head is dropped: the chain starts from the collector, and its note names the kept branch.

Shown on scripted reconcile scenarios: the real reconciler process on a fake bb, with a collector holding a landed child. (a)+(b): the join's implementer commits, files child `b` and reports done. The collector now contains its commit, the join's chain is gone, no drive launched, and `b-implement` launched from a base containing the commit. Before the fix, no child chain started. (c): a resume record for a drive on a branch off main that lacks the collector's head. The join now starts implement at the collector head, and the stale sha is in its note. Before the fix, the log read "P resumes drive from the stopped run's branch P-drive-1". Suite: 252 pass, 2 skip.
