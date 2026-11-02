---
stage: "ticket"
assignee: "agent"
author: "session:thr_nb7a3u9d6a"
priority: 3
---
When the configured observational-memory model isn't in the session's model registry, `resolveModel` in [runtime.ts](../../extensions/context/om/runtime.ts) falls back to the session model and says so only through `ctx.ui.notify` when `hasUI` is set. Headless sessions (bb-bridged workers, reconcilers, replays) switch silently, so memory can run on a 1M-window frontier model at its price, and an acceptance run can report results for a model it didn't use. [[projects/mlegls-pi/issues/om-configured-terra-model-is-absent-from-pi-catalog]] was exactly this lookup failing in a non-UI context (closed as a misdiagnosis of the catalog, not of the fallback). Found by the 2026-11-03 concept adversarial review (@thread:thr_hfihumwjwq), code checked.

## Acceptance

- A missing configured OM model is reported in every context: a UI warning as now, and otherwise a line in the session log or stderr naming the configured and the used model.
- Replays and other scripts that select an OM model fail rather than substitute.
- A test covers the headless case.
