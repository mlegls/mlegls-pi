---
priority: 3
stage: spec
assignee: agent
part-of: "[[projects/mlegls-pi/issues/agentic-setup-reorg]]"
---

hypotheses left open by [[projects/mlegls-pi/research/orchestration-audit-2026-09-18]]. each is a session; split out when claimed.

- cheap review output is acted on: sample five glm-flash review reports, find the parent turn after each, check whether findings appear in later edits or commits. if not, review routing is theater.
- `decision` broadcasts are read: in the factor-finish run, grep peer sessions for `board.read` on the run topic after each decision timestamp. 34 acks vs 452 decisions suggests not.
- fence on cumulative cache-read: per-session cumulative cost vs tool index for the opus workers; find the knee; estimate what respawn-from-ticket at the knee would have saved.
- orchestrate rework (`a7f7a98`, 09-15) worked: runs since with exactly one handle; per-run cost and checkpoint counts vs the 09-14 baseline.
- model spikiness per role: same-shaped review and verify-story tasks across sonnet/astra/glm; parent acceptance vs cost. informs the current routing policy; the historical fixed role table in [[projects/mlegls-pi/issues/archive/pool-aware-routing]] is no longer an open delivery obligation.
split 2026-09-30, corpus verified: [[projects/mlegls-pi/issues/review-output-acted-on]], [[projects/mlegls-pi/issues/decision-broadcasts-read]], [[projects/mlegls-pi/issues/cache-read-fence-knee]], [[projects/mlegls-pi/issues/orchestrate-rework-effect]], [[projects/mlegls-pi/issues/role-model-spikiness]] — independent, no prerequisites. availability: `~/.pi/agent/sessions` complete 09-01..09-30 (5.7 GB; per-message `usage.cost`; model via `model_change.modelId`; workers identifiable only by `__worktrees-<handle>` cwd before the 09-18 session-instrumentation), `~/.local/share/pi-board/log.jsonl` sends 09-14..now (factor-finish: 437 hits), `~/.local/share/pi-board/reads.jsonl` only from 09-18T16:13, system-config `a7f7a98` present. limits carried from [[projects/mlegls-pi/research/orchestration-audit-2026-09-18]]: list-price costs (tokens are the honest unit for subscription models), board log is sends-only before reads.jsonl, tool classification by regex is approximate. all five read static jsonl; no backend restart involved.

2026-09-22 scope: board-specific hypotheses concern the named historical runs, not current Orca messaging. Report corpus availability and limits; do not restart the retired backend to recreate evidence. Split these independently executable measurements before dispatching individual sessions.

decision, 2026-09-30: run after the current supervise operational repairs land; collect delivery and cost evidence meanwhile. Orchestration defaults unchanged.
