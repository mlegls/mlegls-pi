# Role-model spikiness — same-shaped review and verify-story across models, 2026-09-30

Question (docs/issues/role-model-spikiness.md): on same-shaped review and verify-story tasks across sonnet/astra/glm, what is per-role median vs within-role spread, and what did the parent accept? Informs routing.md.

**Finding.** The corpus cannot answer the cross-model question at fixed target: 0 same-target sonnet/astra/glm pairs (1 same-target pair at all, whose glm side died at turn 4), and no verify-story task ran on more than one triad model. What it does contain is a one-day, one-lane campaign where the reviewer model changed with the `agents/reviewer.md` pin, so glm and astra reviews are comparable as descriptive cohorts (9 and 5 delivered reports), not as matched pairs. Within-role cost spread at fixed shape (3.7–71× across the model cohorts with n>1) is as large as the one cross-model contrast on offer, glm vs astra review cost (~10–16×), and that contrast is confounded with unit, effort, and time.

## Reproduction

```
python3 docs/research/role-model-spikiness.py             # ledger.json + role tables + pair ratios
python3 docs/research/role-model-spikiness-acceptance.py  # acceptance.json (review dispositions, verify report tags)
bun test docs/research/role-model-spikiness.test.ts
```

Ledger: [ledger.json](../attachments/role-model-spikiness/ledger.json), one row per session (full session id, file, handle, shape, model, cost, turns, tool calls, tokens, start/last message, last stop reason, exclusion). Acceptance: [acceptance.json](../attachments/role-model-spikiness/acceptance.json).

## Corpus, shape, and exclusions

Session files dated 2026-09-01..09-22 under `~/.pi/agent/sessions/<mangled-cwd>/<ISO>_<uuid>.jsonl` (755 files); board `~/.local/share/pi-board/log.jsonl`. A session is a worker of a shape when its first user message starts with the stance prompt: review = "review the diff you're pointed at" (both wordings, 50 sessions); verify-story = "`verify-story` on what you're given. you're the persona" (32 sessions). Reviews launched from dispatch-style prompts ("start with `dispatch`. … independent source review") and non-template reviews are a different shape and excluded. Model is the `model` on the session's assistant messages (no session mixes models); cost is the sum of `usage.cost.total` (list price); **turns = assistant messages; tool calls = `toolCall` content blocks**. The 09-21..22 Orca-harness glm runs (`run_*` workspaces) are outside both prompts.

Exclusion rule for the medians: a session whose last assistant message has `stopReason: error` (provider death) or that is a smoke test (<5 turns). They stay in the ledger and in n; they are not "completed attempts". Four sessions: `guard-review-2` (glm, error at turn 11), `u2-selfgrade-rereview` glm (error at turn 4), `lifecycle-drive-2` sonnet 13:35 (400 `thinking or redacted_thinking blocks`), `vf` terra (3-turn smoke). Medians are true medians (mean of the middle two for even n).

## Per-role medians at fixed shape

| role, model | n (excluded) | cost $ med [min..max] | turns med [range] | tool calls med | cacheRead tok med |
|---|---|---|---|---|---|
| review, glm flash | 17 (2) | 0.043 [0.020..0.127] | 34 [15..90] | 44 | 1.37M |
| review, astra | 29 (0) | 1.16 [0.26..18.63] | 14 [5..116] | 14 | 0.41M |
| — astra, sessions of 09-14 | 18 | 1.49 [0.26..18.63] | 15.5 [5..116] | 16.5 | 0.59M |
| — astra, sessions of 09-15..16 | 11 | 0.82 [0.34..4.30] | 10 [9..35] | 9 | 0.15M |
| review, opus | 3 (0) | 13.07 [6.44..13.39] | 99 [77..100] | 100 | 14.3M |
| review, deepseek flash | 1 (0) | 0.018 | 25 | 40 | 1.24M |
| verify-story, sonnet | 19 (1) | 7.43 [0.85..14.95] | 196 [35..356] | 202 | 29.7M |
| verify-story, terra | 13 (1) | 1.58 [0.79..2.91] | 70.5 [41..102] | 77.5 | 5.3M |

Anthropic-provider sessions report prompt tokens almost entirely as cacheRead: sonnet verify cost is cache-read volume × $0.2/MTok (29.7M ≈ $6 of the $7.4 median). glm/astra/terra cost gaps are likewise dominated by cache-read price. Terra is adjacent-generation to the triad and not matched to sonnet (09-14 vs 09-15..16, different stories).

Within-role spread (max/min completed cost): glm 6.4×, astra 71× (09-14 era 71×, 09-15..16 era 12.7×), sonnet 17.5×, terra 3.7×, opus 2.1× (n=3). Spread tracks target size and read depth (turns) inside a model; between models the single large contrast is glm vs astra cost.

## What matches, honestly

- same exact target, cross-model, within {sonnet, astra, glm}: **0**.
- same exact target, cross-model at all: **1** — `u2-selfgrade-rereview`: the glm attempt died at turn 4 ($0.003, provider `finish_reason: error`, no report); a deepseek-flash session reviewed the same `daf4972` diff 3.5 h later ($0.018, 25 turns, 6.5 min to report). There is no completed-vs-completed pair.
- verify-story cross-model within the triad: **0**. The verify half is unanswerable here.
- descriptive cohorts (same template, same lane `concept/factor-finish/materials`, same day 09-15, different units): glm 9 delivered reports and 2 provider deaths vs astra 5 delivered reports and 1 no-report session. These are cohorts, not 18 pairs; the earlier "18 campaign pairs" reused 6 first-round and 7 re-review sessions in Cartesian products.

Model assignment in the cohorts was not a lane choice: every unit worker is `--agent reviewer` and got whatever `reviewer.md` `runCommand` pinned at spawn — astra:low until 09-15 08:57Z, glm-flash (`:high` from 10:24Z) until 15:50Z, deepseek-flash:high until 16:18Z, astra:low after (system-config commits de37c99, b745ffe, c7a564f, 2e43850). glm sessions start 10:15Z–14:58Z; U3–U6 (16:37Z on) are astra, same materials lane. So model is perfectly confounded with time in the campaign, unit, and effort (`high` vs `low`).

### First-round unit reviews (per-session)

| session | model | cost $ | turns / tool calls | start → report |
|---|---|---|---|---|
| u1-security-review | glm | 0.127 | 90 / 93 | 21.1 min |
| u2-review | glm | 0.020 | 15 / 21 | 12.4 min |
| u3-review | astra | 0.714 | 9 / 8 | 1.3 min |
| u4-review | astra | 0.770 | 10 / 9 | 1.4 min |
| u5-review | astra | 0.965 | 12 / 11 | 1.9 min |
| u6-review | astra | 0.485 | 9 / 8 | no report (ended after 10.4 min) |

The eight astra/glm Cartesian cost ratios over u1/u2 × u3/u4/u5/u6 are 3.8, 5.6, 6.1, 7.6, 24.3, 35.8, 38.6, 48.4: **median 16×** (mean of the middle two). The ratio of the group medians ($0.74 / $0.073) is 10×; a different statistic. Eight ratios from six sessions is not eight independent encounters, and the direction of the confound (glm read 15–90 turns at `:high`, astra 9–12 at `:low`) is not known, so "upper bound on the pure model effect" is not established.

Re-reviews (per-session): glm $0.048 (u1-rereview, 70 turns), $0.095 (u1-error-rereview, 70), $0.022 (u1-error-delta-review, 32), $0.030 (u2-replay-rereview, 28); astra $0.818 (u6-review-2, 10 turns), $0.373 (fixture-rereview, 9, next day). n=4 vs n=2; no median.

### Wall time to report

routing.md optimizes lowest wall time to accepted completion. Start → board report: glm reports median 14.3 min [10.8..28.9] (n=9), astra 1.4 min [1.1..1.9] (n=5), deepseek 6.5 min (n=1). The astra:low reviews are ~10× faster and ~18× more expensive per session ($0.77 vs $0.043 medians). List-price review cost ($0.04–1.2) is small next to a sonnet verify-story session ($7.4 median), so the dollar difference between review models is minor in this workstream; the wall-time difference and the plan-consumption difference (unmeasured here) are what routing.md weighs.

## Acceptance = what the parent did next

Per-session ledger: [acceptance.json](../attachments/role-model-spikiness/acceptance.json) (board ids, parent ids, parent-session line numbers, latencies). Board report → parent decision latency is 8–14 s wherever the parent replied to the report (workers' topics wake the parent), so it carries no signal; `fixture-rereview`'s row points at the later merge-ready report, not a reply. Dispositions of 18 review workers:

| disposition | glm | astra | deepseek |
|---|---|---|---|
| cleared, merged/joined/accepted | 3 (u1-rereview, u1-error-delta-review, cursor-guard-review) | 2 (u5-review, fixture-rereview) | 1 (u2-selfgrade-rereview) |
| cleared, after a bounded repair | 1 (u1-error-rereview) | 1 (u6-review-2: a UX fix and an unanswered requirement) | — |
| cleared verdict, a claim overridden | 1 (guard-review: "tags only theory constants" false) | — | — |
| blocker → repair spawned | 3 (u1-security-review, u2-review, u2-replay-rereview) | 1 (u4-review, repaired inside U5) | — |
| clear verdict **not accepted** | — | 1 (u3-review) | — |
| cleared | 1 (guard-review-3) | — | — |
| silent (no report) | 2 (provider error) | 1 (u6-review, ended normally) | — |

- Blockers were acted on in every delivered case for both models (glm u2 chain: u2-review blocker → u2-review-replay repair (parent line 601) → u2-replay-rereview blocker → u2-selfgrade-persist (line 775); astra u4-review P2 "repaired inside U5" → joined U4/U5 approved). The parent also rewrote reviewer claims in both classes: glm cursor-guard-review and u1-error-delta-review each lost a nit; astra u3-review reported "no blocking findings" and the parent held U3 (needs-input: "tutor close deliberately … doesn't resolve the parent contract conflict"); `materials-closeout` later ships "requireCompletion on tutor surface.close" (29184790). So "no verdict was overturned" is false: one clear verdict was overturned by the parent, by the parent's own contract reading, and it was an astra one.
- Silent rounds: astra `u6-review` ended normally after 10.4 min with no board send (respawn session began 36 s after; the parent's progress message says it "died silently after reading"). glm `guard-review-2` died at turn 11 (respawn began 75 s after). glm `u2-selfgrade-rereview` died at turn 4 at ~12:42 and the parent kept writing "waiting on `u2-selfgrade-rereview`" (13:05, 13:10, 13:21, 13:22) until it looked at the board at 16:13 and wrote "exited without posting a report" — **detection latency 3.5 h**, wall to accepted clear 3.65 h at a token cost of $0.02. Detection latency is a parent-attention property (75 s vs 3.5 h for the same provider error on the same model), not a model property; cost of the dead attempt is not the cost that mattered.
- verify-story, board messages per worker (not a parent-action trace; the parent's merge/checkpoint decision per lane is not traced): sonnet 19 sessions — done-tagged report in 12, checkpoint-only 5 (final-drive, lifecycle-drive, runtime-drives, runtime-offline, u7b-browser-gate), progress-only 1, dead with no message 1 (lifecycle-drive-2 13:35, provider 400). Successor sessions exist for facet-drive (-2), lifecycle-drive (-2 ×2), guard-drive (guard-redrive), runtime-offline (-b23), u7b-browser-gate (-2): 6 successor sessions across 5 lanes, causes split between provider death (lifecycle-drive-2 13:35 → 13:47) and scope continuation or post-fix re-drive. terra 13 sessions (1 smoke): one session per lane, no successors; done-tagged report in 11 of 12, one ended on checkpoint/handoff (verify-quiz-play). Terra stories are smaller.

Verify-story is the expensive verification surface (cache-read dominated) and has no cross-model evidence.

## What this implies for routing (routing.md)

Evidence level: descriptive, one campaign, model confounded with unit/time/effort. Nothing here separates model quality from task.

1. **glm-flash for review is untested for accepted-completion, not shown to be cheaper.** routing.md asks for lowest wall time to accepted completion at similar total cost, counting plan consumption. glm delivered the same kind of actionable verdicts (blockers acted on, nits sometimes rejected) at ~$0.04 list price and ~14 min to report vs astra:low ~$0.77 and ~1.4 min. The corpus has no plan-consumption measurement for either, and the one glm death cost 3.5 h wall. If GLM plan capacity is used for review, the routing cost is wall time (10×) and a parent that must notice silent provider deaths; a trial should measure subscription consumption and start→accepted wall time on the *same diff* by two reviewers.
2. **A dead flash attempt is cheap in dollars and can be expensive in wall time.** "Retry at flash" only holds if the parent detects the death quickly. Provider death without a report was detected in 75 s once and 3.5 h once (idea: [[projects/mlegls-pi/issues/parent-waits-on-worker-that-died-without-a-report]]).
3. **Verify-story stays on proven drivers**: zero cross-model evidence in the window, cost dominated by cache-read volume, and the 09-23 audit's computer-use frictions already bill that role. A cheaper driver needs its own matched round: same story, two drivers.
4. **Pin depth in the stance.** In the campaign, effort and lane moved turns (astra:low unit reviews 9–12 turns; glm:high 15–90; 09-14 astra audits up to 116) more than anything separable to model identity. Pinned expected depth (guard-review's "verify six hypotheses") keeps medians from being lane artifacts.
5. **Transfer caveat.** The corpus reviewers were verdict-only ("review the diff you're pointed at"); the current `reviewer` stance repairs directly and has different cost and wall time. Nothing above measures the repairing shape.
