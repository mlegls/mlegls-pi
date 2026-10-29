---
stage: "done"
assignee: "agent"
author: "session:01a1863c-c488-76f5-9cd2-1f0ef378e140"
---
Observed 2026-10-28 in arkhai-payments (tree dispute-authority, owner @thread:thr_b8zcwpysi2). A refine worker split mediation-cases (spec) into mediation-case-process and mediation-service-deploy and removed the parent's own stage ("no residual implementation at this parent", 9ab877f; tree showed `own:none`). mediation-case-process landed in collector tree/mediation-cases; the owner moved mediation-service-deploy out of the tree. The reconciler then stopped with "mediation-cases: effective stage done" while tree/mediation-cases held 12 unlanded commits, and mediation-rulings stayed "blocked by mediation-cases (not satisfied at this destination)". Restarting didn't help; setting mediation-cases back to `stage: spec` made it run its join and land the collector.

Cause: in its own collector's view the node is satisfied (no own stage, every child landed there), so it is not ready and never frontier; in its parent's view it is not, since the child landed in the collector, not the parent. Nothing lands the collector. Any own-done or no-residual parent hits this once its children have all landed.

## Result

A node with a collector that is satisfied there but has no landing of its own now starts its join (the self chain that lands the collector) when it has no blockers or claims at its destination, whatever its derived stage (2ee4f3a3). Checked on schedulingView with the observed shape: own view done/satisfied/not frontier, parent view no blockers or claims. Omitting a parent's residual stage remains valid for a refinement (the lifecycle allows no-residual containers), so refinement isn't changed.
