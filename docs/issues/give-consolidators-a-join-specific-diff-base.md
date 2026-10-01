---
stage: idea
assignee: agent
author: session:01a0f0e1-0f71-7377-aa0c-23612f37861e
---

Owner now (2026-10-01): the reconciler's node-own chain (`startPhaseFrom` in `lib/reconcile/reconcile.ts`), whose implement, drive and review are the consolidation.

A Common Concept consolidation launch supplied `git diff aaf4d5573f200a47c06f7020f9eedd06860eca0c..HEAD` as the combined change for `generalize-node-memory-to-source-backed-tagged-observations`. At launch HEAD was `b89190235b221349a41abe7f1576101df05bbbc3`.

Observed: that range changed 2,147 files (131,853 insertions, 3,662 deletions), including unrelated Applet, onboarding, edition, landing and Hub work. All four implementation commits named by the join (`3ed6782b`, `5b99f833`, `c64e96d9`, `92357ffa`) were already ancestors of the supplied base, confirmed with `git merge-base --is-ancestor`. The range therefore omitted their original feature diffs while adding unrelated work.

Workaround: inspect those implementation commits with `git show`, then inspect current feature code and the later correction/review delta. The consolidation stayed in the interpretation code rather than treating the run-wide range as a request to refactor other work.

Proposed: distinguish the run's starting ref from the join's structural-review baseline. When implementations predate either baseline, provide their commit set explicitly rather than calling a later, unrelated range the combined change. The observed range mismatch is established; where that base was selected in the supervision machinery is not.
