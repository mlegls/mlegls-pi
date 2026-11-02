---
stage: "done"
assignee: "human"
author: "session:thr_jwt5e5vaq2"
priority: 2
---
While preparing the required real-ledger acceptance replay for [[projects/mlegls-pi/issues/om-memory-promotes-observer-judgments-over-the-users-own-statements]], @thread:thr_jwt5e5vaq2 found that ~/.pi/agent/settings.json configures memory.schemas.om.model as openai/gpt-6.1-terra, but ModelRuntime.getModel("openai", "gpt-6.1-terra") returns undefined with both the repository's pi 1.2.0 and the installed pi 1.4.0. openai/gpt-6.1-sol and openai/gpt-5.6-terra are in the catalog. ModelRuntime.checkAuth("openai") succeeds (credential values not inspected).

Observed consequence: the ticket's requested replay model cannot be selected. OM Runtime.resolveModel falls back to the foreground session model when a configured model is absent; on hasUI:false that fallback has no notification. No paid request was made and no alternate model substituted. The worker is preparing a replay entry point that fails closed on an unavailable exact model. Decide the intended model identity or provision its catalog entry before acceptance; the configured name alone does not prove the upstream API supports it.

## Result

Misdiagnosis corrected by parent thr_ae8q9yrxnv: openai/gpt-6.1-terra is present via the host ~/.pi/agent/models-store.json; pi --list-models gpt-6.1-terra confirms it. The replay called ModelRuntime.create with refreshOnCreate:false, which skipped disk catalog restoration as well as network refresh. Replay now awaits normal runtime creation against the host auth.json, models.json and models-store.json before reading ModelRegistry. No model substitution is needed; exact-model replay is continuing.
