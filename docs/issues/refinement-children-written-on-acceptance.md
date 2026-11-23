---
stage: "idea"
assignee: "human"
priority: 3
author: "session:01a20657-0e8d-726c-98b9-a4f79a5a23fc"
---
Found in the 2026-11-23 audit of the supervision/issue orchestration system (@thread:thr_3pkhxrd57p).

> **Why it exists**: Because refiners mutate the *live shared tracker* before acceptance, forcing a 7-phase compensating rollback engine (`writing → stopping → cleaning → adopting → accepting → accepted → removed`), per-attempt `reconcile:<root>/<handle>` claims, 4× acceptance re-validation, and O(N²) leaf-order deletion.
> **Cut**: Have refiners return proposed child specs in their handoff (or branch); let the reconciler write them atomically on acceptance. Eliminates ~300 LOC and most `claimed-by` footguns.

See [refinement.ts](../../lib/reconcile/refinement.ts) and [agents/roles/refine.md](../../agents/roles/refine.md). Decide whether to change the refiner contract.
