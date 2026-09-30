---
stage: ticket
assignee: agent
priority: 3
part-of: "[[projects/mlegls-pi/issues/orchestration-audits]]"
---

hypothesis, from [[projects/mlegls-pi/issues/orchestration-audits]]: model spikiness per role: same-shaped review and verify-story tasks across sonnet/astra/glm; parent acceptance vs cost. informs the current routing policy; the historical fixed role table in [[projects/mlegls-pi/issues/archive/pool-aware-routing]] is no longer an open delivery obligation.

corpus: sessions 09-01..09-22 under `~/.pi/agent/sessions`, board-era sends in `~/.local/share/pi-board/log.jsonl`. same-shaped = same task type on comparable targets: review = `review/*` board sends; verify-story = spawn prompts naming verify-story/verify of a leaf (prompts live in parent session toolCall inputs — no agent tags before 09-18). matched pairs live in retries and parallel rounds: multi-checkpoint runs, repeated verify rounds over the same journey (the 09-23 campaign had ~5; see [[projects/mlegls-pi/research/orchestration-audit-2026-09-23]] for the later-harness shape).

method: per pair (same task type, different model): cost, turns, tool calls from session usage/records; acceptance = what the parent did next — accept/merge in later turns vs checkpoint/respawn (board tags + parent session). report per-role medians and within-role spread at fixed shape; spikiness is the variance, not the median. end with what that implies for routing (system-config `routing.md`).

limits: matched cross-model pairs may be thin in 09-01..09-22. if an exhaustive pass finds fewer than ~5, report that as the finding (the corpus cannot answer at this n) instead of medians over two points. glm review identification recipe is shared with [[projects/mlegls-pi/issues/review-output-acted-on]] — reuse its index if it has landed; independent otherwise.
