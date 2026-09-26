# Bash vs exec: recent token use — 2026-09-26

Bash is cheaper to express actions in, but there is no clear end-to-end token win. After matching model, project, thinking level, worktree status and session-age bands, call arguments are 21% smaller; context per request is essentially unchanged. Generated tokens per request are 10% higher, with the increase in recorded reasoning tokens accounting for that. Non-cached input/cache writes are 2.26× higher.

This measures resource footprints, not tokens per successfully completed task. The transcripts do not supply a comparable completion denominator.

Follow-up: [cache and model investigation](bash-exec-cache-2026-09-26.md) finds Connectome folds dominate the cache shortfall, adds memory-write spend missing here, and shows that batching confounds the apparent Luna/Sol disadvantage. These tables alone are not grounds for model-specific tool routing.

## Sample

Local Pi transcripts from September 20 through September 26 04:15:55 UTC, excluding this audit. The actual exec sample ends September 24; almost all bash activity is September 25. These are recent exec sessions versus the new asynchronous bash extension, not the older stock bash/read/edit toolset compared in the [September 23 audit](exec-ts-vs-bash-2026-09-23.md).

| | Exec | Bash |
|---|---:|---:|
| Sessions with ≥5 outer-tool calls | 327 | 234 |
| Assistant requests, including errors/aborts | 42,034 | 20,652 |
| All tool calls | 39,581 | 22,462 |
| Matched outer-tool calls/results | 39,158 | 22,442 |

Session mode requires ≥90% exec or bash among those two call names; one mixed session is excluded. Bash sessions must also contain extension-specific evidence. Temporary-directory sessions are excluded. Deduplication by entry ID, timestamp and type removes 3,374 inherited entries across forked histories. Two malformed lines are skipped. Worktrees under the confirmed Concept Paseo pool are grouped with Concept, not counted as separate projects. Session files are scanned directly; `.ab` ledgers are not transcripts.

Provider-recorded usage supplies input, output, cache reads/writes, reasoning and cost. Context means input + cacheRead + cacheWrite; fresh means input + cacheWrite. Recorded reasoning is reported separately, not added to output. Tool argument JSON and returned text use tiktoken 0.14.0 `o200k_base` as a common proxy, not each provider's tokenizer. Images are excluded from text counts but remain part of provider usage.

## Unadjusted results

| Mean | Exec | Bash | Bash change |
|---|---:|---:|---:|
| Outer-tool argument tokens/call | 148 | 118 | −21% |
| Outer-tool returned text tokens/call | 605 | 736 | +22% |
| Context tokens/request | 104,311 | 101,738 | −2.5% |
| Generated tokens/request | 388 | 533 | +37% |
| Cache-read share of input | 97.9% | 94.4% | −3.4 pp |
| Recorded cost/request | $0.0353 | $0.0224 | −37% |

The apparent cost saving is mostly a different model/workload mix. It does not survive standardization.

Median argument tokens are 74 → 57; median returned text is 196 → 265. The p99 returned text grows from 4,373 to 5,455 tokens. Smaller tool calls do not imply smaller tool results.

## Common-support comparison

Strata: project × model × thinking level × worktree/non-worktree × assistant-message ordinal band (1–20, 21–50, 51–100, 101–200, 201–500, 501+). Retain strata with ≥30 requests and ≥3 sessions in each mode. Weight both modes by the smaller request count in each stratum. This yields 27 strata containing 18,500 exec and 16,780 bash requests, predominantly Concept worktrees.

These are weighted stratum means/ratios, not randomized pairs. Session age is an activity-stage control, not wall-clock age or context length. Fork-inherited messages count toward ordinal but are deduplicated from token totals.

| Standardized mean | Exec | Bash | Bash change |
|---|---:|---:|---:|
| Tool argument tokens/call | 146 | 115 | −21% |
| Returned text tokens/result | 617 | 645 | +4.5% |
| Context tokens/request | 95,115 | 96,592 | +1.6% |
| Generated tokens/request | 443 | 489 | +10.2% |
| Recorded reasoning tokens/request | 274 | 324 | +18.4% |
| Fresh input/write tokens/request | 1,999 | 4,522 | +126% |
| Tool calls/tool-bearing request | 1.016 | 1.122 | +10.4% |
| Context tokens/tool call | 98,806 | 92,131 | −6.8% |
| Generated tokens/tool call | 455 | 447 | −1.6% |
| Recorded cost/request | $0.00878 | $0.00970 | +10.5% |

Bash batches more outer calls per model request. But a call is not an operation: both shell scripts and exec cells compose internally. The per-call reductions are not proof of more useful work per token.

Removing error/aborted assistant messages leaves context/request effectively identical (97,571 → 97,584), generated tokens +8.4%, fresh input/write +122%, and cost/request +8.5%. Without the age control, standardized context appears to fall 8.8%; that apparent win disappears once activity stage is included. Restricting to the overlapping September 23–24 dates leaves no strata meeting the support threshold.

### Model differences remain large

Same age-matched procedure, separated by model:

| Model | Exec/bash requests in support | Context/request | Generated/request | Fresh input/write | Cost/request |
|---|---:|---:|---:|---:|---:|
| Opus 5.5 | 5,917 / 1,683 | −21% | −16% | +28% | −7% |
| GLM 5.3 Flash | 3,200 / 3,315 | −25% | −6% | +119% | +3% |
| GPT-6 Luna | 4,883 / 10,529 | +25% | +27% | +149% | +49% |
| GPT-6 Sol | 4,500 / 1,253 | +31% | +21% | +159% | +50% |

All four have smaller call arguments with bash (−7% to −28%). Context/output differences have opposite signs. That is not a uniform language effect; campaign assignments and execution behavior still differ within the matched groups. The cache regression occurs in all four, including higher cache writes for Opus and higher uncached input for the other three.

## Returned text and asynchronous delivery

A rough, ordered regex classification of call source gives these unadjusted means. Composed calls may do several kinds of work; categories are not operation counts.

| Call category | Exec/bash calls | Argument tokens, exec → bash | Returned text tokens, exec → bash |
|---|---:|---:|---:|
| Edit/write | 5,121 / 2,899 | 539 → 420 | 230 → 491 |
| Read | 17,237 / 10,516 | 87 → 72 | 949 → 970 |
| Search | 2,278 / 2,323 | 85 → 66 | 496 → 548 |
| Test/check | 2,458 / 1,298 | 169 → 171 | 289 → 500 |
| Git | 1,767 / 979 | 72 → 48 | 300 → 487 |

The read-result average is nearly flat. Larger edit/test/git feedback and the changed mix contribute to the aggregate result increase; this is not simply larger file reads. This classification has not been manually validated as a repair-turn classifier.

Separate persisted late-output messages add 20,001 text tokens across 38 exec messages and 40,156 across 114 bash messages. They are outside the tool-result averages above. Their text volume is small relative to ordinary tool results, but each wake can buy another context read; downstream requests are included in usage totals. Late output drained into ordinary tool results is already counted there. There are 204 unmatched exec and 16 unmatched bash outer calls; missing results are not treated as zero-length results.

## Interpretation

- Keep the local finding: bash reduces the tokens needed to express calls, including edits. The saving is about 30 tokens/call, not a large reduction in total generated tokens.
- Do not claim an end-to-end token saving. Context/request is flat after age matching, and the small per-call gain depends on what those calls accomplish.
- Cache reuse is the larger observed economic regression. Its cause is not established: prompt changes, compaction, cache routing/lifetime, concurrency and changed work all remain candidates. This audit does not identify a bash-specific invalidation mechanism.
- Filtering, orchestration and prompts changed alongside the outer tool. Model usage excludes unrecorded selector/judge costs; recorded dollar amounts may be list-price estimates rather than invoices. Summed context counts repeated reads, not unique information.
- A stronger efficiency test would compare matched assignments through accepted completion, ideally crossed over between modes. A useful immediate diagnostic is to locate where cache reuse breaks within otherwise stable sessions.

## Reproduce

```sh
uv run --with tiktoken==0.14.0 python docs/research/bash-vs-exec-tokens.py
uv run python docs/research/bash-vs-exec-summary.py
```

Private per-request/call aggregates and generated summaries are under `/tmp/bash-exec-tokens/`. The scripts write no transcript bodies. No production behavior changed.
