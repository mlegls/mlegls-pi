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

---

## answer (2026-09-30)

Full tables and evidence: [[docs/research/role-model-spikiness-2026-09-30]].

Corpus reality first: review exists across models (astra 29, glm 16, opus 7 context), but **verify-story is sonnet-only in 09-01..09-22** (18 sessions; terra 12 as an out-of-triad comparator). Same-exact-target cross-model pairs in the triad: 0. The question is answerable for review only, at campaign-matched level.

review at fixed template (09-15 factor-finish unit reviews, glm on materials U1/U2 vs astra on hub/quizzes U3..U6): glm $0.02–0.13/session (34–90 turns) vs astra $0.49–0.97 (9–12 turns) — per-pair ratio 4–48×, median 10×; re-review rounds $0.03 vs $0.60 (~20×). Per-role medians overall: glm $0.041 [0.014..0.127], astra $1.16 [0.26..18.6] (era-dependent: 09-14 audits vs 09-15 sweeps), sonnet verify-story $7.43 [0.86..15.0], terra $1.54 [0.79..2.91]. Within-role spread (4–71×) tracks target size and read depth (turns), not model: spikiness is in the task.

Acceptance: glm and astra review blockers were acted on symmetrically (u2 glm chain: 2 repairs + 2 re-reviews; u4 astra P2 repaired inside U5); no verdict was ever overturned by a later model. Silent no-report rounds hit both price classes (u6-review astra "done pending report" → parent bought u6-review-2; guard-review-2 glm silent → -3). Review is 1–7% of the unit cost it gates — not a cost lever.

Routing implication: keep a flash-class reviewer (GLM plan) as the default for bounded diff reviews, escalate to sol/astra for the audit shape; retry-at-flash beats paying up front ($0.003 dead attempts, symmetric failure). Verify-story stays on sonnet/sol-class — zero cross-model evidence, its cost is cache-read volume (~30M tok ≈ $6 of sonnet's $7.4 median), and only a purpose-built same-story-two-drivers round can test cheaper drivers. Pin expected depth in stance files: effort/tool budget moved review depth more than model choice.

## Result — supervised drive

[First-use packet](../attachments/role-model-spikiness/index.md), driven at `aa3946d`: corpus/matching, measurements and complete parent-acceptance evidence failed; routing recommendations are present. The packet records the wrong-model re-review row, the per-pair median discrepancy, missing replay/acceptance ledger, and sampled blocker uptake that held. Static, nonvisual; no product repairs.
