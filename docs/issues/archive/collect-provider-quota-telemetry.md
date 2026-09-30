---
priority: 4
stage: done
assignee: human
author: session:run:run_00e131a4d024
---

Is automatic provider-quota collection still wanted beyond the current caller-supplied usage-aware router? The source investigation is in [[projects/mlegls-pi/issues/archive/pool-aware-routing]]. No provider reader is implemented by lib/pool.ts.

Triage the value of live telemetry before choosing collection, freshness and concurrency semantics. This is not residual work in the completed routing research, nor authorization to poll provider endpoints.

decision, 2026-09-30: deferred until a concrete task needs it; name that task and its user when reopening.

decision, 2026-09-30 (later): reopened and delivered for delegated routing. `lib/allocation.ts` reads quota windows through `quota-axi` (readings reused up to a minute) and gates each agent's model list against `allocation.json`; the task is keeping codex, whose reported window understates available capacity, in use for delegated work.
