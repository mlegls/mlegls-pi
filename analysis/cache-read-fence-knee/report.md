# cache-read knee, opus workers 09-14..16

corpus: `~/.pi/agent/sessions/*/2026-09-1[456]*.jsonl`, `model_change.modelId=claude-opus-5` ∧ `__worktrees` cwd → **40 sessions, ΣR=1,198,142,082 cache-read tokens, $849.21 list, median $13.23/session** (reproduces parent's 40/$849/median 13.4). axis = assistant-call index (tool-call counts in `sessions.json[].ntools`). x_i := input+cacheRead+cacheWrite (context at call i); s_i := cacheRead.

## curve shape (curves.json; excerpt transcript-capture-feasibility)

| i | s_i | x_i | C_i | ampl |
|---|---|---|---|---|
| 10 | 41,659 | 41,905 | 266,176 | .99 |
| 100 | 153,148 | 153,657 | 8,905,780 | 1.00 |
| 225 | 0 (TTL miss) | 339,963 | 38,220,991 | .00 |
| 300 | 427,516 | 428,029 | 66,704,670 | 1.00 |
| 500 | 644,805 | 646,028 | 174,279,079 | 1.00 |
| 583 | 738,811 | 740,244 | 231,720,892 | 1.00 |

amplification s/x → 1.00 after ~10 calls in all 40 sessions: **append-only, cache perfect, no interior knee.** marginal cost per call = x_i, growing ~linearly → C(i) quadratic. x_max: median 239,847, max 740,244; 12/40 sessions crossed 300k. compaction: 9 events corpus-wide.

## knee operationalizations

- slope-doubling vs warm marginal (s_i ≥ 2·median(s[5:11]), sustained): knee at call 8–27 → **already doubled before call ~30** everywhere; divergence from fresh-prefix marginal is immediate, not a knee.
- two-segment changepoint on C(i): late (60–95% of n) — artifact of fitting a quadratic with two lines.
- model-optimal respawn k\*: **degenerate — hits the k=5 search floor in 40/40**; under the counterfactual below, savings increase monotonically with respawn earliness. there is no interior knee to find. the knee is a policy choice = context threshold, not a curve feature.

## steer hypothesis: rejected

- steers do **not** re-pay the prefix: ampl stays 1.00 on the call after a steer (append preserves cache prefix). slope-knee within ±5 calls of a steer: 4/40; changepoint: 6/40; k\*: 1/40.
- the only re-pays are **TTL/full-price on >5min gaps**: 103 calls, 14.5M cacheWrite + 342 input ≈ 1.2% of R (`nmiss`/`miss_w` in sessions.json; s=0 rows in curves.json).
- 145 steers corpus-wide; 51 (35%) within 10min of a checkpoint-tagged board row (`~/.local/share/pi-board/log.jsonl`, 13/40 sessions have checkpoint traffic) — checkpoints and steers co-occur (parent answers checkpoint with steer) but neither is a cache event (`board_corr.json`).

## respawn-from-ticket counterfactual (lower bound on respawn cost, i.e. savings are an upper bound)

at knee k: pay C_k (sunk) + replay post-k calls in fresh sessions, segments delimited by steers; segment [a..b] pays (b−a+1)·P0 + (x_b − x_a); P0 = median first-5-call cacheRead (ticket+system+tools). **charges zero re-derivation overhead** (fresh session re-reads repo state for free beyond P0) — real savings strictly less.

| policy knee | corpus saved | % of R |
|---|---|---|
| respawn when x ≥ 100k | 1,044,243,577 | 87% |
| respawn when x ≥ 200k | 750,417,573 | 63% |
| respawn when x ≥ 300k | 420,912,404 | 35% |

worst at x≥300k (tokens): transcript-capture-feasibility 195.2M/231.7M (84%), hook-emission-snapshots 134.0M/159.6M (84%), vertex-176 21.6M (36%), browser-consolidation 16.4M (30%), browser-route-shell 12.9M (21%), byok-177 12.8M (25%). 28/40 sessions never reach 300k.

## fence contrast (live setting, post-dates corpus)

`extensions/fence/index.ts:26-30`: threshold = `PI_CHECKPOINT` ratio, else 0.3 of window for ≥400k windows, else 0.6; on crossing, steers `agent-prompts→agents/_fence.md` once (checkpoint protocol), compacts at agent_end (`index.ts:62-69`). bounds **x (context fraction), not Σx (cumulative reads)** — re-arms when usage drops under, so a continued worker re-pays its (compacted, smaller) prefix each lap: cumulative reads stay Σx_i but with x capped at the fence instead of riding to 740k. fence committed `a7391d2` 09-14 20:11 + `913c720` 20:15 (canonical `mlegls-pi` log); both named extremes finished 09-14 by 14:18 → **the corpus is pre-fence**; its unbounded-x curves are exactly what the fence exists to prevent, and its counterfactual column ≈ fence+compaction realized.

## files

`scan.py` (corpus filter+parse), `final.py` (knees+counterfactual → `sessions.json` int keys, `curves.json`), `board_corr.py` → `board_corr.json`. `sessions.json`/`curves.json` JSON round-trips int dict keys to strings.
