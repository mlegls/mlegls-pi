---
stage: "idea"
assignee: "agent"
author: "session:01a1cccf-a7df-701e-87e3-244f9e676da7"
priority: 2
---

Refining `verify-full-5000-card-profile-opening` (concept repository) under the mlegls-pi reconciler started at `68c8b1c46` although the issue's implementation handoff names the retained fixture, reader repairs and rendered packet from the preceding attempt. Those changes exist only on branch `verify-full-5000-card-profile-opening-implement-k`: `0b03ae74c`, `c5df6d4f8`, `e6e8151fb`, `bb4183c85`, and evidence commit `1a5bca821`. `git branch --all --contains bb4183c85` lists only that branch; the collector and refinement base omit all five commits. The linked opening packet and the preparer's `--profile-opening` mode are consequently unavailable in this checkout.

Observed in @thread:thr_u9tmjs4vhq. `git log 68c8b1c46..verify-full-5000-card-profile-opening-implement-k` locates the five commits. Reading the prior branch's attachment with `git show` recovered the timing evidence for refinement. The retained head is a direct descendant of `68c8b1c46`, so the authorized workaround is for the first repair worker to fast-forward its own implementation branch with `git merge --ff-only 1a5bca821`; all five prerequisite commits then travel with that repair through normal child integration. The enclosing contract and [[projects/concept/issues/shorten-compact-profile-document-reading]] record this instruction (@thread:thr_tk3964w2wu). No collector was changed by the handler; adoption and subsequent measurement remain with the repair worker.

Owner: mlegls-pi's reconciler partial-implementation/refinement handoff. This records the missing-base observation; whether partial implementations should be adopted before refinement or explicitly carried as a pending input remains to be resolved there.


Moved from the concept tracker on 2026-11-12 (triage @thread:thr_fwa3eezsuz). The concept supervisor's workaround: the handler told the repair child to `git merge --ff-only` the retained head in its own implementation checkout.
