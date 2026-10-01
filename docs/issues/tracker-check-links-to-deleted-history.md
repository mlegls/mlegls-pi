---
stage: idea
assignee: agent
author: session:01a0f6bc-8c6b-7179-b390-af3b53e964e3
---

During [[projects/mlegls-pi/issues/tree-sidebar-bridge-fixes]], `bun ~/.pi/agent/skills/tracker/scripts/issues.ts check` exited 1 with 20 dangling historical links. Examples: archived orchestration issues point to deleted `research/orchestration-audit-2026-09-18` and `research/orchestration-audit-2026-09-23`; several archived issues point to deleted `ingress`; archived `compaction-register-variants` points to absent `hibernate-native-fallback-loses-provenance`. Some cross-project Concept evidence targets are also absent.

All diagnosed files are unchanged from this worker's base `c4312ef`; none is in the sidebar implementation scope. No link was silently removed and no checker was weakened. Reconcile these historical references with their surviving evidence, or remove link syntax where only the historical name survives. [Diagnostics](../attachments/tree-sidebar-bridge-fixes/tracker-check.txt).
