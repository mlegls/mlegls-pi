# Cache-read knee, Opus workers 09-14..16

Corpus: session files starting 2026-09-14..16, `model_change.modelId=claude-opus-5`, worktree cwd. All 40 selected sessions used only that model. **1,198,142,082 cache-read tokens; $849.21 list-price; median $13.23/session.** Dollars are a corpus cross-check, not a proposed spending fence: subscription models ride weekly pools, so list-price savings are not invoice or pool savings.

[Complete worst-first actual/counterfactual table](results.md), [full curves](curves.json), [session summaries](sessions.json), [timestamped knee correlations](board_corr.json). Reproduce with `python3 analysis/cache-read-fence-knee/final.py` and `python3 analysis/cache-read-fence-knee/board_corr.py`; Python stdlib only. Both accept `--sessions-root` and `--output-dir`; correlation also accepts `--board-log`.

## Curve axes and observations

`curves.json` is keyed by session ID, with **every billed assistant call** (6,306 total), not samples. Each record gives `assistant_index` (1-based), `tool_index` (cumulative emitted tool calls), `tool_first`/`tools` (the complete inclusive tool-index range emitted by this assistant call), timestamp, marginal `cache_read`, `context`, and `cumulative_cache_read`. A multi-tool assistant call pays its context **once**, before all its tools: every index in that range shares this cumulative read value. A no-tool call adds reads at the same tool index. Do not interpolate omitted tool indices or charge again per tool. This mapping preserves all 558/406 tool indices for the extremes as well as their 583/424 billed assistant calls.

x_i = input + cacheRead + cacheWrite; s_i = cacheRead; C_i = Σ_(j≤i) s_j. These are token counts, not dollars. Example transcript-capture-feasibility:

| assistant index | tool index | s_i | x_i | C_i |
|---:|---:|---:|---:|---:|
| 202 (first x≥300k) | 194 | 298,729 | 302,666 | 31,267,735 |
| 583 (last) | 558 | 738,811 | 740,244 | 231,720,892 |

Growing context makes cumulative reads roughly quadratic on long append-only stretches. Median maximum context is 239,847 tokens; maximum 740,244; 12/40 reach 300k. This is not uniformly perfect caching: there are 103 calls with s_i < 0.5 x_i, including 28 first calls; of the other 75, only 46 follow a >300-second gap. Nine compaction events occur. Thus neither “all misses are TTL” nor “all sessions are pure append-only” follows from the curves.

## knee operationalizations

- Slope-doubling: first call with s_i ≥ 2·median(s[5:11]), sustained for three calls. **13–58, 38 non-null / 2 null**, now consistently 1-based (the driver's 12–57 was zero-based). These are marginal doubling thresholds, not proven abrupt transitions.
- Two-line least-squares split on cumulative reads: **24.7–61.8% of assistant calls**. Even smooth quadratic growth produces such a split; do not treat it as evidence of a steer-induced discontinuity.
- Model-optimal first reset k*: **5–81 assistant calls, only 1/40 at the k=5 search floor**, after repairing per-call charges. This replaces the earlier erroneous all-at-floor result. The search considers k=5..n−6, and subsequent resets at user follow-ups; k* is a hindsight model optimum, not a detected knee.

There is no established common steer-triggered knee. Cite an **explicit context policy in tokens** (100k/200k/300k), not an intrinsic knee or a dollar threshold. The complete table includes the model optimum as an alternate accounting choice.

## Steers and checkpoint timestamps

User text after the first prompt is the steer proxy; parent authorship is not separately encoded in these old records. 145 proxy follow-ups map to 145 next assistant calls. Median post-follow-up s/x is 0.995, with 115/145 ≥0.95, **but 26/145 are cache misses**. Appending a follow-up normally preserves caching; the data do not support claiming that steers always invalidate the prefix, nor that they never do. No causal inference from temporal co-occurrence alone.

`board_corr.json` retains checkpoint IDs/topics/timestamps, original user timestamps, and every slope/split/optimum/policy point with its nearest steer, own checkpoint, run checkpoint, signed gaps (**event minus knee seconds**) and adjacent usage records. Board matching uses exact cwd or exact final topic component, restricted to the session lifetime; run prefixes are inferred from the worker's own topics. Checkpoints are tagged rows or rows whose first 40 body characters mention checkpoint. Missing events are explicit nulls; run attribution is a topic heuristic, not a run ID. Under this stricter matching, **50/145** follow-ups are within ten minutes of an own checkpoint; **13/40** sessions have own checkpoint rows (the earlier 51 used assistant-response timestamps and an unbounded handle substring).

For transcript-capture's 300k policy: assistant call 202 / tool 194 at `2026-09-14T10:28:11.109Z`; nearest steer `10:18:19.846Z` (−591.263s); nearest own/run checkpoint `11:20:27.171Z`, `mu15ix43-kcn7zb` (+3136.062s). The knee call is a cache hit (298,729 / 302,666), not a prefix invalidation. Hook-emission's corresponding point is assistant 133 / tool 152 at `06:54:00.565Z`; steer −65.541s, checkpoint +1186.144s. All other points, including explicit missing checkpoints, are available in the JSON.

## Respawn-from-ticket counterfactual (ideal replay estimate)

At first threshold crossing k (1-based), pay C_k once. Replay calls k+1..n in fresh sessions, resetting again before each later user follow-up. For each segment [a..b], charge **Σ_(j=a..b) [P0 + max(0, x_j − x_a)]**, not just its final growth. P0 = median first-five-call cacheRead (a heuristic for ticket+system+tools, not an observed reconstructed ticket). No crossing means counterfactual = actual and savings = 0.

This is an **ideal warm-cache read-equivalent workload estimate**, not a literal prediction of provider `cacheRead`: cold fresh prefixes incur cache-write/input rates, not read rates. It charges zero state re-derivation overhead and assumes historical within-segment growth survives a restart unchanged. The nine compactions and other context decreases are handled by max(0, growth), not simulated anew. These optimistic assumptions make estimated savings an upper bound within this replay model, not a measured achievable respawn result. Actual input/output/write cost is not converted into the read-token comparison. A real respawn could cost more than continuing.

Public deterministic estimator: `python3 analysis/cache-read-fence-knee/final.py --estimate-json '{"x":[10000,20000,30000],"P0":10000,"k":0}'` → 60,000. Supply `cumulative_reads` when k>0 to include sunk reads.

Corrected savings: **820,313,826 (68.5%) / 675,105,506 (56.3%) / 392,220,286 (32.7%)** at context ≥100k/200k/300k. Transcript-capture at 300k: actual 231,720,892 / counterfactual 41,104,327 / saved 190,616,565; hook-emission: 159,620,858 / 36,760,154 / 122,860,704. The earlier 87/63/35% estimates undercharged growth. [All 40 sessions and all three policies, worst actual reads first](results.md); `sessions.json` also retains per-session model-optimal k*/actual/counterfactual.

## Fence contrast (current configuration, historical deployment unknown)

Checked `~/.config/system-config` first: its `agents` and `agent-prompts` are symlinks into `~/dev/mlegls-pi`. The live extension in that checkout, `extensions/fence/index.ts:26-30`, reads:

```ts
const env = Number(process.env.PI_CHECKPOINT);
if (Number.isFinite(env) && env > 0) return env > 1 ? env / 100 : env;
return contextWindow >= 400_000 ? 0.3 : 0.6;
```

Only active for workers with `PI_BOARD_TOPIC`, inactive while connectome owns the context. Crossing sends the checkpoint steer once; it compacts at `agent_end` if still over threshold, and re-arms once below. This bounds **context fraction**, not cumulative cache reads. It is not a hard per-call cap: a running tool/turn can overshoot before the hook fires. Current worker env overrides and historic effective values are not recoverable from these session files.

Fence commits: `a7391d2` at **2026-09-14T20:11:10+08:00 = 12:11:10Z**, `913c720` at **20:15:57+08:00 = 12:15:57Z**. Hook-emission ended 08:57:06Z, before the commits; transcript-capture ended 14:18:03Z, **after** them. Six sessions ended before the first commit, 32 started after it, two overlapped. Commit time is not load time. The earlier “entire corpus is pre-fence” conclusion mixed timezones and is withdrawn; these observations cannot isolate a deployed-fence effect or equate the model with fence+compaction.

## files

`scan.py` (filter/parse), `final.py` (complete curves, knees, per-call estimator → sessions.json / curves.json / results.md), `board_corr.py` (timestamp links → board_corr.json). JSON policy keys are strings (`"100"`, `"200"`, `"300"`). Curves use session IDs, not worktree names, so restarts cannot overwrite each other. Generated Python bytecode is untracked/ignored. Tests: `bun test analysis/cache-read-fence-knee/cache-read-fence-knee.test.ts`.
