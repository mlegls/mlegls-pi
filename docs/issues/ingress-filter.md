---
stage: spec
assignee: agent
part-of: "[[projects/mlegls-pi/issues/agentic-setup-reorg]]"
---

External data reaches the parent at the fidelity its reading needs, with recoverable originals and unchanged retained values. The current contract is [Exec ingress](../ingress.md): five retention levels, local prose compression, exact code/excerpt fallbacks and raw/pull recovery. The September 20 binary p >= .2 prototype is superseded, not the calibration target.

The display integration is delivered. Residual acceptance is evidence-backed calibration of the current policy, using [[projects/mlegls-pi/issues/reranker-eval]]: reconcile its measurements with the reading promise, document the limits, and either accept the policy or give each demonstrated defect a separate owner. Building a richer chunker is not implied by completing the measurement.

Historical evidence: the September 20 live runner drove source filtering, pull/raw, loaded-skill passthrough, notifications and fail-open behavior; 196 tests passed, 2 skipped. That proves the earlier boundary worked, not current task-level fidelity or a calibrated miss rate. Current guide and implementation are docs/ingress.md and lib/ingress.ts.
