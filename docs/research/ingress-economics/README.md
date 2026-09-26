# Jev read-filter economics — 2026-09-26

The filter probably pays for itself on expensive models. It does not have a convincing money-saving case as a blanket default for the current Luna-heavy workload. Context reduction is real; net bill reduction is not established.

## Measurements

Local Pi sessions, September 22 through September 26 at 11:00 UTC; persisted entry IDs plus timestamps deduplicate forked histories. 542 files contain new version-3 filter events. Of 19,481 unique successful filters, 19,452 reconstructed outputs match recorded byte lengths; 29 do not and are excluded from token/cost estimates. Older filter versions are excluded.

| Quantity | Result |
| --- | ---: |
| Original → filtered text, before display caps | 32.62M → 18.43M proxy tokens |
| Reduction before caps | 14.20M tokens (43.5%) |
| Reduction with independent recorded byte caps | 6.36M tokens |
| Reconstructed Jev inputs, including repeated query and instructions | 113.39M proxy tokens / 25,889 batches |
| Estimated Jev cost, sensitivity range | **$5.71–9.52** |
| One fresh ingestion value, observed model prices, cap scenario | **$8.95** |
| Same value without caps | $19.94 |
| Additional value if every cap-adjusted saved token gets one cached reread | $0.75 |
| Filters returning unchanged text | 8,273 (42.5%) |
| Share of reconstructed Jev input spent on unchanged outputs | 22.1% |
| Successful filter latency | median 1.02s; p95 9.24s |

These are nominal token economics, not invoice savings. `routing.md` explicitly identifies Codex and Z.ai as subscription pools. Reducing their context may preserve allowance or avoid overflow, but does not directly lower a fixed subscription bill.

## Model-specific break-even

The table uses the cap scenario, one fresh ingestion, then repeated cached reads. It excludes recovery overhead. An additional cached read means a saved token remains absent for another request; this is a token-weighted lifetime, not simply the number of later turns in the session.

| Model | Estimated Jev cost | Fresh input value | Additional cached reads to break even |
| --- | ---: | ---: | ---: |
| Astra 6 | $0.22–0.37 | $3.62 | 0 |
| Sol 6 | $0.93–1.55 | $2.21 | 0 |
| Opus 5.5 | $0.55–0.91 | $2.40 | 0 |
| Luna 6 | **$3.62–6.03** | **$0.38** | **86–150** |
| GLM 5.3 Flash | $0.24–0.39 | $0.04 | 28–49 |

Luna accounts for 10,418 filters and about 63% of reconstructed Jev input. Even ignoring display caps entirely, its one-time context value is only $0.89. Cheap models, not Jev's absolute price, are the problem.

The workload shift matters: September 25–26 accounts for about **$3.58–5.97** in estimated Jev spend against **$1.83** of cap-adjusted fresh-input value. Under the uniform cached-reread scenario, that subset needs approximately **13–30 additional reads** to break even before recovery costs. Earlier expensive-model sessions make the overall aggregate look better.

Formula: `net = saved_tokens × (fresh_price + cached_reads × cache_price) − judge_cost − recovery_cost`. Prices vary by model; averaging them before accounting for which model received which output gives misleading results.

## Recovery and measurement limits

- 521 tool results follow commands containing explicit ingress pulls, including `ab pull`, which does not emit the legacy `pull` event. These results contain 780,713 proxy tokens. Charging their entire bodies against cap savings leaves approximately **5.58M tokens**; mixed-command output makes this a conservative debit, not exact recovered-page accounting. Ordinary raw rereads remain unclassified.
- Fresh input value of those whole results is $0.37. Whole following assistant requests cost $5.64 nominally. The latter is a stress-test recovery tax, **not an attributable cost**: needed verification also pulls, commands can combine work, and the model might have made those requests anyway. Do not add both debits; they overlap.
- There are 358 version-3 judge failures and 977 compression failures. Failed judgment request sizes/usage are not recorded; their possibly billable work is absent from the cost range. Compression failures fall back to excerpts; their successful judge work is included.
- `lib/decide.ts` discards `result.usage`. `jev-axi usage` is a different ledger and does **not** include these direct calls. Exact historical Jev spending cannot be recovered from the filter logs.
- Main-model and reconstructed payload tokens use `o200k_base`. Two live synthetic probes returned 1,108 and 6,862 billed Jev input tokens versus 723 and 5,609 proxy tokens: ratios **1.53×** and **1.22×**. Cost scenarios use **1.2–2×**, not a statistical confidence interval or guaranteed bound. The probes cost about $0.000335 at the reference rate.
- [Cloudflare's official Jev listing](https://developers.cloudflare.com/ai/models/typesafe/jev/) quotes $0.042/M input tokens and free output. [Vercel's listing](https://vercel.com/ai-gateway/models/jev) agrees. This is the reference rate, not a retrieved TypeSafe invoice. The current shell uses the direct TypeSafe backend.
- Payload reconstruction uses the current policy, including one fidelity question per passage and speculative excerpt selection. Historical prompts changed. A synthetic reconstructed payload was compared against the actual current `judge()` request and matched exactly; historical billing serialization is not available.
- Caps independently truncate original and filtered text before tokenization. This is a sensitivity scenario, not exact delivery accounting: shared budgets, truncation notices, and bash versus exec differ. Current bash does not apply a final hard cap after ingress. The uncapped comparison is reported separately rather than crediting Jev for all ordinary truncation savings.
- Subsequent cached reuse is **not measured** here. Filtering changes future reads and possibly task outcomes; compaction and connectome folding alter residence time. Chronologically counting every later request would over-credit savings. The next assistant message supplies observed nominal unit prices, not a proved causal delivery join.
- LLMLingua local compute, electricity, latency cost, and quality effects are unpriced. Summed successful-filter time is 12.6 hours across overlapping calls/sessions, not 12.6 hours of added wall time.

## Recommendation

Keep filtering on expensive models, subject to fidelity checks. Do not justify always-on filtering for Luna/GLM as a demonstrated dollar saving. For cheap subscription workers, bypass it by default unless context capacity or quota is the actual constraint; deterministic outlines, search, and ordinary truncation still reduce context without a classifier bill.

Before tuning the policy further, retain Jev's returned usage and join filter events to delivered tool results and context retirement. That makes measured spend and token residence available without introducing another judging layer. A raw/filter comparison on matched tasks is still needed for net cost to accepted completion, including recovery and mistakes.

No runtime behavior was changed.

## Reproduction

```sh
uv run --with tiktoken python docs/research/ingress-economics/audit.py > /tmp/ingress-economics.json
```

Optional arguments: session directory, exclusive UTC cutoff. Default cutoff: `2026-09-26T11:00:00Z`. The script reads local session text but makes no network calls and emits only aggregates. `2026-09-26.json` is the saved aggregate snapshot; private session bodies are not repository fixtures.
