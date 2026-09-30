# Role-model spikiness — same-shaped review and verify-story across models, 2026-09-30

Question (docs/issues/role-model-spikiness.md): on same-shaped review and verify-story tasks across sonnet/astra/glm, what is per-role median vs within-role spread, and what did the parent accept? Informs routing.md.

Corpus: sessions 2026-09-01..09-22 under `~/.pi/agent/sessions/<mangled-cwd>/<ISO>_<uuid>.jsonl` (model from `model_change.modelId`, per-message `usage.cost`); board sends `~/.local/share/pi-board/log.jsonl`. Costs are list-price dollars; token totals (in/out/cacheRead, summed over the session) are the comparable unit. The 09-21..22 glm runs are Orca-harness sessions (`run_*` workspaces) with different shapes — excluded.

Shape is fixed by prompt template, verified from each worker's first user message:

- review: "review the diff you're pointed at…" (the `reviewer` stance body) — n=53 workers (astra 29, glm flash 16, opus 7 context, deepseek 1 context).
- verify-story: "`verify-story` on what you're given. you're the persona…" — n=31 (sonnet 18, terra 12, terra smoke 1). Zero astra or glm verify-story exists in the window.

Model per session is ground truth from the session file. It was also a live routing experiment: `agents/reviewer.md` runCommand churned through 09-15 — `~z-ai/glm-flash-latest` (to 18:17) → `openrouter/~z-ai/glm-flash-latest:high` (18:24) → `openrouter/~deepseek/deepseek-v4-flash-latest:high` (23:50) → `openai-codex/gpt-6-astra:low` (09-16 00:18). Materials-lane supervisors passed `--agent reviewer` (got glm); hub/quizzes lanes spawned astra in that window by explicit choice or older spawn paths.

## Per-role medians at fixed shape

| role, model | n | cost $ med [min..max] | turns med [range] | tool calls med | in tok med | cacheRead tok med |
|---|---|---|---|---|---|---|
| review, glm flash | 16 | 0.041 [0.014..0.127] | 34 [11..90] | 43 | 156K | 1.32M |
| review, astra 09-14 era | 18 | 1.49 [0.26..18.6] | 16 [5..116] | 17 | 66K | 592K |
| review, astra 09-15..16 era | 11 | 0.82 [0.34..4.3] | 10 [9..35] | 9 | 51K | 149K |
| review, opus (context) | 7 | 9.0 [1.6..17.4] | 99 [21..142] | 100 | 206* | 12.9M |
| review, deepseek flash (context) | 1 | 0.018 | 25 | 40 | 52K | 1.24M |
| verify-story, sonnet | 18 | 7.43 [0.86..15.0] | 196 [35..356] | 202 | 392* | 29.7M |
| verify-story, terra | 12 | 1.54 [0.79..2.91] | 68 [41..102] | 72 | 165K | 4.93M |

\* anthropic-provider sessions report prompt tokens almost entirely as cacheRead; sonnet verify cost is cache-read volume × $0.2/MTok (29.7M ≈ $6 of the $7.4 median). glm/astra/terra gaps are likewise dominated by cache-read price (z-ai ≈ free, astra $1/MTok).

Within-role spread at fixed shape is large for every model and tracks target size and read depth (turns), not model identity: glm 9×, astra 71× (≈4× within one era), sonnet 17×, terra 3.7×.

## The matched family: factor-finish unit reviews, 09-15 (same campaign, same template, one day)

First-round unit reviews — materials units U1/U2 by glm, hub/quizzes units U3..U6 by astra:

| pair side | sessions ($/turns/toolcalls) |
|---|---|
| glm 1st-round | u1-security-review $0.127/90/93; u2-review $0.020/15/21 |
| astra 1st-round | u3-review $0.714/9/8; u4-review $0.770/10/9; u5-review $0.965/12/11; u6-review $0.485/9/8 |
| glm re-reviews | u1-rereview $0.048/70/72; u1-error-rereview $0.095/70/97; u1-error-delta-review $0.022/32/42; u2-replay-rereview $0.030/28/36; u2-selfgrade-rereview $0.018/25/40 |
| astra re-reviews | u6-review-2 $0.818/10/9; fixture-rereview $0.373/9/8 |

Per-pair astra/glm first-round cost ratio 4–48×, median 10×; re-review median $0.030 (glm) vs $0.595 (astra), ~20×. glm reviews read more (34–90 turns vs 9–12) at 1/10–1/30 the cost; depth co-varied with lane, so the ratio is an upper bound on the pure model effect.

Matched-pair accounting, honestly:

- campaign-matched cross-model pairs (same template + same campaign day + same round kind): 18 (8 first-round, 10 re-review). Confound: model co-varies with supervisor lane and target.
- same-exact-target cross-model pairs within {sonnet, astra, glm}: 0.
- same-exact-target cross-model at all: 1 — u2-selfgrade-rereview: glm attempt died silently at turn 4 ($0.003); deepseek-flash completed the same diff 3.5h later for $0.018 (6×).
- verify-story cross-model within the triad: 0 — the verify half of the question is unanswerable in this corpus. terra (09-14) vs sonnet (09-15..16) is adjacent-generation, not matched: different sub-campaigns and story sizes (terra T41–102 vs sonnet T35–356).

## Acceptance = what the parent did next

- glm review findings were acted on every time they blocked: u2-review blockers → `u2-review-replay` (technical fix spawn 12:17) → u2-replay-rereview found a further blocker (raw selfGrade) → second repair → u2-selfgrade-rereview cleared it ("closes every counterexample from the u2-replay-rereview ruling", 16:21). u1 chain: security review + repair + re-review, all worktrees closed `--keep-branch` 11:50 (merge path).
- astra review findings likewise acted on: u4-review P2 (retained receipts override reopened-surface lifecycle) "repaired inside U5" (finish-materials-remainder 17:08); browser-consolidation-review's three P2s repaired ~40 min later (18:47 review → 18:51 repaired/frozen → 18:53 terra re-drive); fixture-rereview "ACCEPT 9e772a0".
- No verdict was overturned by a later model on the same diff anywhere in the window.
- Silent no-report rounds happened on both sides: u6-review (astra) ended "done pending report" at 16:56:59 with no board send → parent paid u6-review-2 for a verdict; guard-review-2 (glm) T11 silent → guard-review-3 on the newer diff. Reliability noise is symmetric across price classes.
- verify-story sonnet: 6/18 lanes got a follow-up round (facet-drive-2, lifecycle-drive-2 ×2, u7b-browser-gate-2, runtime-offline-b23, guard-redrive). Causes split: one provider death ("second lifecycle pass died on an upstream provider error … 400 invalid_request_error: thinking or redacted_thinking blocks", finish-private-hub 13:47 — $2 re-roll, not model quality), the rest scope continuation or post-fix re-drive (guard-redrive verified the guard repairs). The other 12 lanes merged or checkpointed-to-done.
- verify-story terra: 12/12 single-round done with handoff, no respawns — on smaller stories.

Review is 1–7% of the unit cost it gates (review median $0.04–1.16 vs sonnet implementer/verifier sessions $5–15), so review model choice is not a cost lever at all; it is a verdict-quality and latency lever. Verify-story is the expensive verification surface (cache-read-dominated), and it has no cross-model evidence.

## What this implies for routing

1. Reviewer is the demonstrated cheap-role: same-shape glm-flash verdicts were acted on and never overturned at 1/10–1/30 astra's cost, with more read depth. `agents/reviewer.md` currently pins `gpt-6.1-sol:high`; the corpus supports a flash-class default for bounded diff reviews, escalating to sol/astra only for the audit shape (hook-snapshot-audit: $18.6, 25 sends, spawned follow-ups). This matches routing.md's GLM line — compare measured plan consumption, which here is pennies.
2. Flash-class deaths are cheap ($0.003) and symmetric across price classes; a dead flash attempt ≈ 250× cheaper than one astra median review. Retry-at-flash beats paying up front for every review round.
3. Verify-story must stay on proven drivers (sonnet/sol-class) — not because cheaper models failed there, but because there is zero cross-model evidence; the 09-23 audit's computer-use frictions already bill that role. If GLM-plan capacity is to be tried on drive, it needs its own matched round (same story, two drivers) — this corpus cannot justify or refute it.
4. Effort and tool budget are part of the stance, and they moved depth more than model choice did (astra:low unit reviews were 9–12-turn sweeps; glm reviews 28–90-turn reads). Stance files should pin expected depth (guard-review's "verify six hypotheses" is the good example), otherwise per-role medians are lane artifacts.
5. Spikiness is in the task, not the model: within-role spread (4–71×) dwarfs the between-model quality differences the corpus can detect. Route roles, pin depth, and let cache-read price (not token price) drive the model choice for turn-heavy roles.
