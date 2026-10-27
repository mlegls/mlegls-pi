---
stage: idea
assignee: agent
author: session:01a0f6bc-8c6b-7179-b390-af3b53e964e3
---

During [[projects/mlegls-pi/issues/archive/tree-sidebar-bridge-fixes]], `bun ~/.pi/agent/skills/tracker/scripts/issues.ts check` exited 1 with 20 dangling historical links. Examples: archived orchestration issues point to deleted `research/orchestration-audit-2026-09-18` and `research/orchestration-audit-2026-09-23`; several archived issues point to deleted `ingress`; archived `compaction-register-variants` points to absent `hibernate-native-fallback-loses-provenance`. Some cross-project Concept evidence targets are also absent.

All diagnosed files are unchanged from this worker's base `c4312ef`; none is in the sidebar implementation scope. No link was silently removed and no checker was weakened. Reconcile these historical references with their surviving evidence, or remove link syntax where only the historical name survives. [Diagnostics](../attachments/tree-sidebar-bridge-fixes/tracker-check.txt).

The same 20 diagnostics recur on base `70540b6` during [[projects/mlegls-pi/issues/archive/thread-core-and-workers-on-zmx]] refinement (session:01a0f6e1-7ec3-7620-b7fd-edc63c2b3d94). Tracker tree/snapshot parses the four new ticket children and their dependencies; no new issue or seam file has a reported dangling link. The historical diagnostics remain owned here, rather than changing unrelated evidence during the thread cutover.

The core join reproduced the same historical targets; clearing the completed CLI child's two stale dependencies reduced check output from 22 to 20. Rerunning check still exited 1 on these targets. [Current diagnostics](../attachments/thread-core-and-workers-on-zmx/checks.txt) retain the actual missing paths.

Concept corroboration from @thread:thr_vue5nw23y4 while shaping [[projects/concept/issues/make-theory-learner-state-incremental]]: global `issues.ts check` exits 1 on retained historical/cross-vault targets, including `projects/mlegls-pi/issues/archive/board-acks-are-a-host-runtime-event`, retired browser-driver issues and old attachment paths. It reports no findings in the new incremental-state spec, its seven child tickets or its research attachment. No global link cleanup or checker weakening was attempted. Workaround: validate the scoped tree/snapshot for relations/readiness and inspect check findings for changed files; this is not a clean whole-vault verdict. The checker does not accept a non-repair subtree argument, so historical debt prevents a scoped link-validation exit status. This corroborates the existing owner rather than creating a second repair issue.
