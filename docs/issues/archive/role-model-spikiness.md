---
stage: done
assignee: agent
priority: 3
part-of: "[[projects/mlegls-pi/issues/archive/orchestration-audits]]"
---

hypothesis, from [[projects/mlegls-pi/issues/archive/orchestration-audits]]: model spikiness per role: same-shaped review and verify-story tasks across sonnet/astra/glm; parent acceptance vs cost. informs the current routing policy; the historical fixed role table in [[projects/mlegls-pi/issues/archive/pool-aware-routing]] is no longer an open delivery obligation.

corpus: sessions 09-01..09-22 under `~/.pi/agent/sessions`, board-era sends in `~/.local/share/pi-board/log.jsonl`. same-shaped = same task type on comparable targets: review = `review/*` board sends; verify-story = spawn prompts naming verify-story/verify of a leaf (prompts live in parent session toolCall inputs — no agent tags before 09-18). matched pairs live in retries and parallel rounds: multi-checkpoint runs, repeated verify rounds over the same journey (the 09-23 campaign had ~5; see [[projects/mlegls-pi/research/orchestration-audit-2026-09-23]] for the later-harness shape).

method: per pair (same task type, different model): cost, turns, tool calls from session usage/records; acceptance = what the parent did next — accept/merge in later turns vs checkpoint/respawn (board tags + parent session). report per-role medians and within-role spread at fixed shape; spikiness is the variance, not the median. end with what that implies for routing (system-config `routing.md`).

limits: matched cross-model pairs may be thin in 09-01..09-22. if an exhaustive pass finds fewer than ~5, report that as the finding (the corpus cannot answer at this n) instead of medians over two points. glm review identification recipe is shared with [[projects/mlegls-pi/issues/archive/review-output-acted-on]] — reuse its index if it has landed; independent otherwise.

---

## answer (2026-09-30)

Full tables, ledgers and reproduction: [[docs/research/role-model-spikiness-2026-09-30]].

**The corpus cannot answer the cross-model question at fixed target.** Same-target sonnet/astra/glm pairs: 0. Same-target cross-model at all: 1 (`u2-selfgrade-rereview`; the glm side died at turn 4, deepseek-flash completed it). verify-story ran on sonnet (19 sessions) and terra (13) only; no triad cross-model verify-story exists in 09-01..09-22. Below the ~5-pair threshold, so no model-quality medians are offered.

What exists is a descriptive cohort from one day and one lane: reviewer model followed the `agents/reviewer.md` pin at spawn time (astra:low, then glm-flash:high 10:24Z-15:50Z, deepseek-flash, astra:low from 16:18Z on 09-15), so glm (9 delivered reports) vs astra (5) is confounded with unit, effort and time. Completed-attempt medians at fixed shape (cost / turns): review glm $0.043 / 34, astra $1.16 / 14, opus $13.1 / 99; verify-story sonnet $7.43 / 196, terra $1.58 / 70.5. Within-role cost spread 3.7-71×. First-round glm vs astra per-pair cost ratio median 16× (8 ratios from 6 sessions; group-median ratio 10×). Wall time start → report: glm 14.3 min, astra 1.4 min.

Acceptance (18 review workers, per-session ledger): blockers were acted on for both models; the parent also rejected reviewer nits or claims in both, and overturned one clear astra verdict (`u3-review`). Silent rounds: 2 glm provider deaths and 1 astra no-report; one glm death went unnoticed for 3.5 h ([[projects/mlegls-pi/issues/archive/parent-waits-on-worker-that-died-without-a-report]]).

Routing implication: the corpus supports no claim that flash-class review is the cheaper route to accepted completion; it shows ~$0.04 list price and ~14 min to report against ~$0.77 and ~1.4 min, no plan-consumption or accepted-wall-time measurement, and a dead flash attempt that cost 3.5 h of wall. Verify-story stays on proven drivers (no cross-model evidence); a cheaper driver needs a same-story-two-drivers round. Pin expected depth in stance files.

## Result — supervised drive and review

[First-use packet](../attachments/role-model-spikiness/index.md), driven at `aa3946d`: corpus/matching, measurements and complete parent-acceptance evidence failed; the review section of the packet repairs them and records final outcomes. Tests: `bun test docs/research/role-model-spikiness.test.ts`.

## Verification evidence

[Encounter and evidence](../attachments/role-model-spikiness/index.md).
