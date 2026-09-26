# Bash vs exec: cache and model follow-up — 2026-09-26

Keep bash for now; do not route Luna/Sol back to exec on the evidence from the first audit. The large cache regression is concentrated at Connectome folds, not ordinary bash turns. More generated tokens per request also partly reflects more calls per request. Neither finding establishes better or worse task completion.

The next experiment should hold the outer tool fixed and change memory policy. No production configuration was changed in this audit.

## The missing variable was Connectome

Connectome was introduced at September 25 01:41 UTC (`5225627`), with per-session defaults and worker enablement later that morning. The first audit's exec cohort ends September 24; almost all bash activity is September 25. The language comparison therefore also compared memory backends.

Joined all 62,686 retained assistant requests from the [token audit](bash-vs-exec-2026-09-26.md) to their transcript predecessors. For 14,858 requests, a per-session Connectome compile trace is available within 30 seconds before the recorded request start (100 ms tolerance for timestamp order). Its `lib.log` supplies the actual solver and fold-move count. Unjoined requests are **not** assumed to have Connectome disabled: older/named lives are outside this join.

The steady-transition subset requires the same provider/model/API, a linear assistant predecessor, neither request errored/aborted, less than 60 seconds between previous completion and current request start, and no intervening recorded compaction/branch summary/system-prompt change.

Define a conservative **prefix-shortfall proxy**:

```
max(0, min(previous input total, current input total) - current cacheRead)
```

Input total includes fresh input, cache writes and cache reads. This is not byte-level prefix reconstruction: deletion, role transformations and provider cache behavior can all produce a shortfall. It excludes previous generated output, making it conservative for append-only reuse. Fresh input/write tokens include both new material and this shortfall; treating all fresh input as cache loss was too coarse.

## Actual folds account for most of the cache shortfall

Means over steady transitions; bash columns have matched Connectome and solver traces:

| Model | Exec prefix shortfall | Bash, no fold | Bash, fold | Fold requests |
|---|---:|---:|---:|---:|
| Opus 5.5 | 31 | 472 | 227,798 | 19 |
| GLM 5.3 Flash | 322 | 534 | 101,455 | 34 |
| GPT-6 Luna | 746 | 814 | 130,095 | 223 |
| GPT-6 Sol | 372 | 337 | 103,815 | 22 |

298 folds are **2.1% of 13,962 traced steady requests**, but account for **57.6% of fresh input/write tokens** and **81.3% of the prefix-shortfall proxy** in that subset. Every one has a shortfall greater than 8k tokens. The recorded solver is `kv-stable`, not an accidental fallback to `flat-profile`.

For Luna specifically, mean fresh input/write is 2,564 tokens without a fold versus 130,203 with one. Ordinary bash transitions are not routinely breaking its entire cache. Long gaps also matter, but these fold events occur within the fast-transition subset, not after cache expiration-sized idle periods.

A concrete trace: session `01a0d6d3-5b3b-706f-b363-231ea2e3546b`, September 25 04:43:44 UTC. Compiled messages fall 163 → 133 while Pi history grows 163 → 165; reused originals fall to 125; the solver reports 40 moves. The resulting request has 95,616 input tokens and only 4,608 cache-read tokens. Subsequent requests reuse the new prefix until another fold.

The surrounding requests make the tradeoff visible:

| Request | Input total | Cache read | Fresh input | Fold moves |
|---|---:|---:|---:|---:|
| 04:43:32 | 107,047 | 105,984 | 1,063 | 0 |
| 04:43:44 | 95,616 | 4,608 | 91,008 | 40 |
| 04:43:58 | 96,420 | 94,720 | 1,700 | 0 |

At the recorded 10:1 fresh/cache-read price ratio, an 11,431-token reduction takes roughly 72 subsequent all-cached requests to amortize the extra cost of rereading 91,008 tokens, ignoring memory generation. This session folds 42 times in 509 requests, a median ten requests apart. That suggests the fold policy is too eager economically; it is an illustrative local calculation, not a full counterfactual, since savings can accumulate and the history cannot grow indefinitely.

This identifies the locus of the loss, not the counterfactual cost of disabling memory. Uncompressed histories would grow larger and eventually require compaction too.

## Three integration/policy issues, not bash syntax

1. **The cache-preservation limit is effectively unbounded.** The adapter selects `foldingStrategy: "kv-stable"` but does not set `kvStableReachTokens`. In context-manager 0.10.1, `src/adaptive/kv-control.ts:819` defaults the perturbation allowance to the whole window: `p.reachTokens ?? p.windowTokens`. Thus “KV-stable” does not prohibit invalidating nearly the entire cached conversation. A finite reach is an existing upstream setting, not a reason to write another compactor. It is a trust region with overrides, not an absolute cap; a specific value still needs replay/testing.
2. **Cache seams are lost at the adapter boundary.** The library's compiled messages carry `cacheBreakpoint`; memory requests can also carry `cacheTtl`. `extensions/connectome/index.ts`'s `toPiMessages` and `membraneFor` do not forward them. The installed Pi Anthropic serializer places its own history breakpoint on the last user/system message, rather than consuming the library's internal seams. Merely adding an unknown field to Pi messages would not fix that. This is relevant to Anthropic; Luna/Sol use automatic prefix caching, so it is not their explanation.
3. **Budget estimation is open-loop.** The library exposes `reportRealInputTokens` on the strategy, but the adapter never feeds provider usage back. Historical compile budgets also differ (the example above uses a 136k prompt budget; later settings use 200k). The installed 0.10.1 is behind [0.11.0](https://github.com/anima-research/context-manager/blob/main/CHANGELOG.md), released September 25, which fixes signed-thinking and rendered-body token estimation. An upgrade is worth evaluating, but those release notes do not promise to fix the folding policy or missing seams.

These paths are shared by bash and exec. Returning to exec with the current memory adapter does not remove them.

## Memory writes were absent from the previous cost totals

Per-session `memory-writes.jsonl` adds **3,155 calls, 4.98M output tokens and $90.18 recorded cost** in the same audit window. This includes Astra as well as the four main comparison models. The corresponding session/model pairs have $208.71 of foreground cost: memory formation adds 43% to those recorded foreground costs. Named/older lives are not included, so this is not complete machine-wide memory spend. Costs are provider-recorded estimates, not invoices.

These are additional observed calls, not incremental cost relative to exec's old compaction: separate Pi compaction-model usage was not included in the earlier totals either.

| Model | Memory calls | Memory cost | Foreground cost in those session/model pairs |
|---|---:|---:|---:|
| Opus 5.5 | 384 | $69.54 | $142.74 |
| GLM 5.3 Flash | 612 | $2.16 | $9.83 |
| GPT-6 Luna | 1,859 | $3.79 | $15.32 |
| GPT-6 Sol | 282 | $9.20 | $32.65 |
| GPT-6 Astra | 18 | $5.49 | $8.17 |

Speculative memory production deserves its own test. In 97 of the 130 session/model pairs with memory writes, the foreground sample has no matched fold; those writes cost $38.67. This is “not observed consumed by a fold in this window,” not proof the memories will never be useful. Short task-scoped workers and persistent interactive lives need not use the same pre-production policy.

The adapter currently performs memory writes on the live session's model. Changing only the library's `compressionModel` string would not select a cheaper provider in this adapter.

## The apparent model split is not a routing result

Added a rough stance classifier from the first 250 characters of the first user message, then repeated the first audit's common-support standardization with stance as another key. It recognizes the explicit dispatch templates (`implement`, `verify-story`, `fill`, `supervise`, etc.); unmatched prompts remain `other`. It is not a task-complexity classifier. GLM has no supported stance-matched comparison under this classifier, so its earlier apparent advantage cannot be refined this way.

Luna's first 20 assistant requests, matched by project/model/thinking/worktree/stance (645 exec and 2,348 bash requests in support):

| Standardized measure | Exec | Bash | Change |
|---|---:|---:|---:|
| Calls/tool-bearing request | 1.00 | 1.54 | +54% |
| Generated tokens/request | 309 | 469 | +52% |
| Generated tokens/tool call | 317 | 260 | −18% |
| Context tokens/tool call | 24,529 | 17,499 | −29% |
| Argument tokens/tool call | 92 | 63 | −31% |
| Returned text tokens/result | 1,583 | 1,093 | −31% |
| Fresh input/write tokens/request | 3,051 | 3,306 | +8% |

The early-turn reasoning increase persists, but bash also batches substantially more calls. Different internal composition makes “a call” an imperfect denominator in either direction. These numbers neither prove a bash win nor justify routing Luna back to exec. Across the full stance-matched Luna sample, generated tokens/call are 476 → 497 (+4.6%), much smaller than the per-request difference. Sol's generated/request difference falls from +21% in the earlier age-matched comparison to +7% after adding stance.

## Decision and next measurement

- **Return to exec:** not justified by the cache results. Keep it available for work needing persistent structured values, not as a cache workaround.
- **Fix bash:** keep examining output feedback/recovery separately, but the dominant cache finding belongs to the shared memory adapter. Do not infer that a shell or tool-description patch will recover it.
- **Split by model:** not yet. The denominator changes with batching, assignment mix still differs, and memory affects all four models. Model-specific memory cost/policy is a better-supported distinction than model-specific outer language.

First hold bash fixed and compare current memory against a constrained policy: finite `kvStableReachTokens`, faithful provider cache seams where supported, and a less speculative policy for task-scoped workers. Use the library's existing replay/configuration surfaces. Include memory-write spend and accepted task completion; do not optimize cache-hit percentage alone at the expense of useful context or completion. A temporary Connectome-off control would establish the remaining memory tax, not necessarily the desired permanent configuration.

Only then compare exec versus bash on equivalent bounded assignments, with memory policy, model, thinking level and output filtering held fixed. Normalize by accepted completion and wall time, counting all requests and side-model spend. The present data does not support maintaining two default tool surfaces by model.

## Reproduce

After running the [first audit's extractors](bash-vs-exec-2026-09-26.md#reproduce):

```sh
uv run python docs/research/bash-exec-cache.py
uv run python docs/research/bash-exec-cache-summary.py
```

Numeric request metadata, joins and summaries are under `/tmp/bash-exec-tokens/`; no transcript bodies are written by these scripts. Accounting checks: all 62,686 requests joined uniquely, every prefix-shortfall value lies between zero and fresh input/write tokens, and every joined solver record names `kv-stable`.
