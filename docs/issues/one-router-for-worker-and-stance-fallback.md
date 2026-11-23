---
stage: "idea"
assignee: "human"
priority: 3
author: "session:01a20657-0e8d-726c-98b9-a4f79a5a23fc"
---
Found in the 2026-11-23 audit of the supervision/issue orchestration system (@thread:thr_3pkhxrd57p).

> **Dual stance routers** (`extensions/stances/index.ts` vs `lib/worker-execution.ts`—used by only 1 of 12 agents, `manager.md`) have already diverged twice. Unify into one routing function.

Current divergences:
- [extensions/stances/index.ts:66](../../extensions/stances/index.ts) ignores `allocation.json` capacity on retry fallback.
- [worker-execution.ts:35](../../lib/worker-execution.ts) fails to unwrap `pi/`-prefixed Codex routes on retry.

Decide whether to unify; otherwise fix the two divergences in place.
