---
priority: 3
stage: done
assignee: agent
part-of: "[[projects/mlegls-pi/issues/archive/agentic-setup-reorg]]"
---

hypotheses left open by [[projects/mlegls-pi/research/orchestration-audit-2026-09-18]]. each is a session; split out when claimed.

- cheap review output is acted on: sample five glm-flash review reports, find the parent turn after each, check whether findings appear in later edits or commits. if not, review routing is theater.
- `decision` broadcasts are read: in the factor-finish run, grep peer sessions for `board.read` on the run topic after each decision timestamp. 34 acks vs 452 decisions suggests not.
- fence on cumulative cache-read: per-session cumulative cost vs tool index for the opus workers; find the knee; estimate what respawn-from-ticket at the knee would have saved.
- orchestrate rework (`a7f7a98`, 09-15) worked: runs since with exactly one handle; per-run cost and checkpoint counts vs the 09-14 baseline.
- model spikiness per role: same-shaped review and verify-story tasks across sonnet/astra/glm; parent acceptance vs cost. informs the current routing policy; the historical fixed role table in [[projects/mlegls-pi/issues/archive/pool-aware-routing]] is no longer an open delivery obligation.
split 2026-09-30, corpus verified: [[projects/mlegls-pi/issues/archive/review-output-acted-on]], [[projects/mlegls-pi/issues/archive/decision-broadcasts-read]], [[projects/mlegls-pi/issues/archive/cache-read-fence-knee]], [[projects/mlegls-pi/issues/archive/orchestrate-rework-effect]], [[projects/mlegls-pi/issues/archive/role-model-spikiness]] — independent, no prerequisites. availability: `~/.pi/agent/sessions` complete 09-01..09-30 (5.7 GB; per-message `usage.cost`; model via `model_change.modelId`; workers identifiable only by `__worktrees-<handle>` cwd before the 09-18 session-instrumentation), `~/.local/share/pi-board/log.jsonl` sends 09-14..now (factor-finish: 437 hits), `~/.local/share/pi-board/reads.jsonl` only from 09-18T16:13, system-config `a7f7a98` present. limits carried from [[projects/mlegls-pi/research/orchestration-audit-2026-09-18]]: list-price costs (tokens are the honest unit for subscription models), board log is sends-only before reads.jsonl, tool classification by regex is approximate. all five read static jsonl; no backend restart involved.

2026-09-22 scope: board-specific hypotheses concern the named historical runs, not current Orca messaging. Report corpus availability and limits; do not restart the retired backend to recreate evidence. Split these independently executable measurements before dispatching individual sessions.

decision, 2026-09-30: run after the current supervise operational repairs land; collect delivery and cost evidence meanwhile. Orchestration defaults unchanged.

## answer (2026-09-30, joined)

All five split hypotheses answered by their tickets; evidence, corpora and limits live there.

- cheap review output is acted on — yes: 16/22 actionable findings fixed, 4 consciously declined/substituted, 2 ignored (cosmetic); a parent turn follows every report within ~2 min and repairs land 5–72 min after it (median ≈10). Not theater on this sample. [[projects/mlegls-pi/issues/archive/review-output-acted-on]]
- `decision` broadcasts are read — 114/133 factor-finish decisions reached ≥1 peer (86% by pull ∪ wake-push, a floor since reads outside stored tool results are invisible; 112 (84%) by pull alone, 2 push-only; restatement-relay near zero); the dead tail is base-topic/glob mismatch. The dead-weight inference from "34 acks vs 452 decisions" is rejected. [[projects/mlegls-pi/issues/archive/decision-broadcasts-read]]
- fence on cumulative cache-read — no established common steer-triggered knee (slope and two-line splits are artifacts of smooth growth; model-optimal first reset ranges 5–81 calls). Follow-up steers normally keep the prefix cached (115/145 with cache share ≥0.95) but 26/145 are misses, so neither "steers always re-pay" nor "never" holds. Respawn-from-ticket replay at *policy* context points 100k/200k/300k (ideal warm-cache read-equivalent upper bound, not invoice, pool or achieved savings) saves 68.5/56.3/32.7% of read tokens. The live fence bounds context fraction, not cumulative reads; the historically effective setting and load time are unknown, so no deployed-fence effect is isolated. Nothing here argues for a cumulative-read fence. [[projects/mlegls-pi/issues/archive/cache-read-fence-knee]]
- orchestrate rework worked — measurements improved (worker $/run mean 63→17, median 10.67→4.74; never-done 13/183→2/40 handles; checkpoint sends 47→7; one root dispatcher per resolvable run in both eras) but opus left the roster and run mix changed on 09-16, so the fall is not attributable to `a7f7a98`; the board simultaneously stopped being the run spine (sends 1134→100). [[projects/mlegls-pi/issues/archive/orchestrate-rework-effect]]
- model spikiness per role — the corpus cannot answer cross-model at fixed target (0 triad pairs, 1 cross-model pair whose glm side died at turn 4). Descriptive only: review glm $0.043/34 turns vs astra $1.16/14 vs opus $13.1/99; verify-story sonnet $7.43/196 vs terra $1.58/70.5; review blockers were acted on for both glm and astra reviewers and reviewer claims were rejected for both (one astra "no blocking findings" verdict was overturned), with verify-story parent actions untraced; one silent glm death waited on 3.5 h. Routing stays hypothesis; the answer names depth pins and a same-story-two-drivers verify round as the cheap next measurements. [[projects/mlegls-pi/issues/archive/role-model-spikiness]]

Joint reading against the 2026-09-30 decision: nothing found overturns a current orchestration default — cheap reviewers are acted on, decision broadcasts reach peers, the cache-read replay gives no case for a cumulative-read fence, the orchestrate rework's effects are favorable but confounded, and there is no cross-model evidence to re-pin roles. Defaults unchanged. Residue is filed elsewhere, not open here: [[projects/mlegls-pi/issues/parent-waits-on-worker-that-died-without-a-report]], [[projects/mlegls-pi/issues/driver-board-read-leaks-implementer-conclusions]].

2026-09-22 scope closed: all five ran on the static 09-01..09-30 jsonl corpus with no backend restart; board-specific conclusions concern the named historical runs; corpus availability and limits are recorded per ticket and carry the 09-18 audit's caveats.

## Result

Final state after review 2026-09-30: joined decision-read and cache-knee bullets corrected to match their child reports (pull-only 84% vs pull ∪ push 86%; cache uncertainty and policy-vs-deployed fence restored); role acceptance wording no longer claims parity. All seven stories hold; checks encoded in `analysis/orchestration-audits/joined-answer.test.ts`. Packet: [verification packet](../attachments/orchestration-audits/index.md) (first-use drive plus review). Original first-use drive result: all five child answers and reviewed packets reachable; the joined decision-read and cache-knee summaries conflicted with their child reports.

## Verification evidence

Per hypothesis: [review-output-acted-on](../attachments/review-output-acted-on/index.md), [decision-broadcasts-read](../attachments/decision-broadcasts-read/index.md), [cache-read-fence-knee](../attachments/cache-read-fence-knee/index.md), [orchestrate-rework-effect](../attachments/orchestrate-rework-effect/index.md), [role-model-spikiness](../attachments/role-model-spikiness/index.md).
