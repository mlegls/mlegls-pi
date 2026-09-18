---
next: measure
part-of: "[[projects/mlegls-pi/issues/agentic-setup-reorg]]"
blocked-by: ["[[projects/mlegls-pi/issues/session-instrumentation]]"]
---

hypotheses left open by [[projects/mlegls-pi/research/orchestration-audit-2026-09-18]]. each is a session; split out when claimed.

- cheap review output is acted on: sample five glm-flash review reports, find the parent turn after each, check whether findings appear in later edits or commits. if not, review routing is theater.
- `decision` broadcasts are read: in the factor-finish run, grep peer sessions for `board.read` on the run topic after each decision timestamp. 34 acks vs 452 decisions suggests not.
- fence on cumulative cache-read: per-session cumulative cost vs tool index for the opus workers; find the knee; estimate what respawn-from-ticket at the knee would have saved.
- orchestrate rework (`a7f7a98`, 09-15) worked: runs since with exactly one handle; per-run cost and checkpoint counts vs the 09-14 baseline.
- model spikiness per role: same-shaped review and verify-story tasks across sonnet/astra/glm; parent acceptance vs cost. feeds "[[projects/mlegls-pi/issues/pool-aware-routing]]".
