# Ingress economics and asynchronous delivery — 2026-09-23

## Result

Ingress substantially reduces displayed context. The logs do not establish a causal reduction in total billed tokens or cost to accepted completion. Most measured reduction comes from omission and exact excerpts, not LLMLingua token deletion. Async execution is compatible with fewer model requests, but asynchronous execution and waking the model should be separate decisions.

## Sample and method

Scanned 2,116 local Pi session JSONL files. There were 62 files with version-3 ingress events. The version-3 filter sample spans 2026-09-22 04:22 UTC through 2026-09-23 01:19 UTC. Deduplicating persisted entry IDs across forked histories removes 31 duplicate filters, leaving 1,137.

Reconstructed filter output from recorded pages, modes, previews, headings, excerpt selection and grouped omission handles. All 1,168 pre-deduplication reconstructions matched recorded output byte lengths. Counted text with tiktoken's o200k_base as a common proxy, not the exact tokenizer of every provider. Recovery notices and skim labels are included.

The cap-adjusted comparison independently truncates original and filtered text to each event's recorded byte budget before counting. It is an estimate, not exact delivered-message accounting: multiple values can share an output budget, and output truncation adds notices. Raw displays, small bypassed outputs, images and earlier filter versions are outside this comparison. Historical versions without retained source cannot support the same token reconstruction.

Temporary analysis and private source extracts are under /tmp/ingress-audit/ on the audit machine; they are not repository fixtures. No private session bodies are committed.

| Version-3 filter text | Original | Filtered | Reduction |
| --- | ---: | ---: | ---: |
| Before ordinary display caps | 2,624,291 | 1,060,103 | 1,564,188 (59.6%) |
| Independently applying recorded caps | 1,348,300 | 784,516 | 563,784 (41.8%) |

Twelve explicit pull events recover 10,199 proxy tokens. Subtracting those gives approximately 554k cap-adjusted tokens saved, but is **not** net end-to-end savings. A search for altered pages appearing verbatim in the next two later exec results found 80 candidate recovery episodes, covering 71,379 page tokens. These include explicit pulls, legitimate later inspection, repeated diagnostics and raw rereads; they are not 80 proven unnecessary turns and must not be added to pull totals without deduplication.

A confirmed failure: two audit workers requested an issue's audit charter, including scope and exclusions. One explicitly supplied that reading focus. The filter reduced the document to its opening question; the worker then requested the full raw document. The chosen mode was skim75 but the actual representation was one exact excerpt, not 75% retention. This is a mismatch between the fidelity judgment and the renderer's available representation, not merely a token-compressor problem.

## Where the savings and overhead are

- 395 of 1,137 filters returned unchanged text (34.7%). This does not itself prove the judgment was unnecessary, but its latency bought no context reduction.
- Final token-compressed prose comprises 281 pages: 97 cues, 154 skim75 and 30 skim50. Their source is 134,947 proxy tokens and previews total 70,634. The 64,313-token difference is before labels/headings/caps: at most about 4.1% of the aggregate pre-cap reduction. This is not a controlled estimate of incremental benefit over exact excerpts.
- Omitted pages contain about 1.24M source tokens; exact excerpts account for much of the remaining reduction.
- Successful filtering latency: median 1.113s, p95 5.534s, summed 1,969.922s. The sum is work across concurrent calls/sessions, not added wall time.
- Seven version-3 judgment failures kept original output. Twenty compression failures fell back to excerpts: eighteen invalid responses and two fifteen-second timeouts. The invalid-response cause was not diagnosed.
- The successful sample implies 1,626 eight-passage judgment batches. Repeated query text alone contributes about 1.15M proxy input tokens, plus about 2.62M source tokens, before decision instructions, criteria and serialization. These are not measured Jev billing tokens. Local LLMLingua also consumes compute.

The main model rereads retained output across subsequent requests, so one-time display reduction understates its potential benefit. Conversely, recovery requests reread the whole active context. Actual net economics require request lineage, compaction boundaries, recovery attribution and judge usage. Summing tokens across different models without prices also obscures the purpose of a cheap selector.

## Async execution

Inspected repository HEAD d0a951d and installed Pi 0.87.0 agent-session handling. The sample contains only three new-style detached exec results and no persisted exec-output messages. There is not yet a useful production sample for measuring the new wake policy.

Current behavior:

1. Kernel execution ordinarily waits for the cell and its shows, up to ten seconds. Async-by-default does not mean every show immediately returns a separate tool result.
2. After detachment, output accumulates while the agent is busy. The next exec result drains the queue together with its own output.
3. When the agent settles, queued output is flushed. Idle arrivals schedule a 250ms flush; a batch judged novel triggers a model run. Thus sufficiently separated arrivals can each cause a new run, but every show does not necessarily do so.
4. Passive cell-completion notices do not wake the agent. Novelty judgment suppresses already-accounted-for results, not all results that would be better consumed together.
5. show.sync and wait inhibit the ordinary timed yield, but pending user messages can still detach execution. A single show receiving multiple promises can group logically joint evidence; separate shows permit independent delivery.

The installed Pi defers a triggering custom message received during agent_settled until settlement completes, then starts an agent prompt. Consequently the idle wake path really can purchase another context read. UI presentation alone is not a model request.

## Recommended direction

Keep omission/excerpt filtering; do not infer that LLMLingua has earned its latency and complexity from the aggregate savings. Compare exact-or-omit/excerpts against the five-level pipeline, including recoveries and task outcomes.

Prioritize the charter failure: fidelity judgments should describe the actual representation available. A skim75 decision cannot safely stand in for choosing one short excerpt. Read contracts, acceptance criteria and evidence needed for an imminent decision exactly; keep peripheral exploration compressible.

Keep async execution. Batch results that inform one decision, and use synchronous presentation when no useful independent work remains. If logs later demonstrate wake amplification, add a bounded coalescing policy rather than reverting execution to blocking. The objective is useful work per model request, not minimum tool count or maximum immediate notification.

Next telemetry should join filter IDs to final delivered text and assistant requests; record judged input/output usage and why a late-output batch triggered a run. Explicit pull counts alone undercount recovery. No production behavior was changed in this audit.
