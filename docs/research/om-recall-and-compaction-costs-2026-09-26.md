# OM recall frequency and compaction cost napkin — 2026-09-26

## Original-context recall

Across September 20–24, the foreground transcripts contain **six organic `recall` attempts in five sessions**. An additional call was an explicit smoke fixture requesting `abcd1234abcd`; the extractor excludes that entire session.

The six calls recover an original implementation assignment twice, a server-start failure, browser-fixture evidence, and an earlier conceptual discussion; one attempt instead returns “No observation or reflection … was found on the current branch.” Its replacement ID succeeds. Thus five returns contain source context and one does not. This is checking retrieval output, not grading its usefulness.

`om-recall-frequency.py` counts assistant requests after an OM ledger marker, within the date window, deduplicating `(entry ID, timestamp)` across copied transcripts. OM activation and prior compaction are chronological markers, not per-entry branch-ancestry proofs. Files contributing unique entries are not independent lives. This measures the explicit foreground `recall` tool, not filesystem rereads, manual transcript searches, or background-worker access to source text. It does not establish how often recall *should* have been used.

Exact aggregate counts are in the command output; roughly 42k assistant requests and 14k requests after an OM compaction imply **one organic recall per 7,000 foreground requests, or per 2,300 post-compaction requests**. This is rare enough that source recall was not the main routine mechanism maintaining continuity in this cohort. The earlier six-message boundary screen missed these later calls.

```sh
uv run python docs/research/om-recall-frequency.py
```

## Cost napkin: per 150k new source tokens

This is an illustrative budget, not reconstructed billing. Keep the foreground task and compaction cadence equal. Ignore shared system overhead and a shared verbatim tail. Assume a conventional summary produces 5k tokens.

Installed OM defaults observe every 10k new source tokens and consider reflection every 20k. The observer receives the new chunk **plus current observations and reflections**. Reflection receives the existing memory pool; dropping runs conditionally after reflection when the pool is sufficiently full. These are agent loops, not guaranteed single inference calls: the observer records observations through a tool and is instructed to finish with a confirmation. Reasoning and additional rounds can add cost. Current worker configuration selects Luna medium; historical configuration exposure is not established.

One explicit set of assumptions:

- 15 observations × (10k source + 10k prior memory + 2k instructions) = **330k input**.
- Seven reflections × 12k memory/instructions = **84k input**.
- Three conditional dropper runs × 12k = **36k input**.
- Total: **450k input for one inference per stage**, roughly **900k plus tool/output history** if each uses two. Use **450k–1M input** as a working range, not a bound.
- Assume **20k–40k generated tokens** across all stages, including an allowance for reasoning. This is an assumption; stage-output usage was not recovered from historical OM ledgers.
- Conventional one-shot summary: **150k input + 5k output**. Native Pi can additionally summarize a split-turn prefix, so not every real compaction is one call.

At illustrative rates of **$1/M fresh input, $0.10/M cached input, $5/M output**:

| Memory production | Input | Output | Cost |
|---|---:|---:|---:|
| Conventional, fresh source | 150k | 5k | **$0.175** |
| Conventional, ideally cached source | 150k cached | 5k | **$0.040** |
| OM, working range, fresh input | 450k–1M | 20k–40k | **$0.55–$1.20** |

At equal model prices, that is about **3–7×** the fresh-input one-shot summary. The ideal cached baseline is a sensitivity case, **not what stock Pi necessarily achieves**: installed native compaction serializes conversation into a new summarization prompt rather than appending to the original foreground prefix. OM also uses a separate observer prompt, including changing local time before the memory body. Do not credit either with foreground cache reuse automatically. Within an agent loop some input can still be cached, lowering the fresh-input estimate.

If OM's worker is ten times cheaper than the model doing self-summary, its production cost becomes **$0.055–$0.12**, below the $0.175 baseline. Break-even in this napkin is a worker priced roughly **3–7× cheaper**. But conventional compaction can also use that cheap model; delegation is not an intrinsic OM advantage. Thinking/output mix and actual provider cache behavior can change the ratio substantially.

### Foreground costs do not disappear

OM's background observation does not itself shrink the foreground prefix in this integration; its projection is injected at compaction. Both methods pay a foreground cache disturbance when replacing history. With the same cut, summary size, and retained tail, those costs largely cancel in a comparison.

Memory length can dominate over many turns. If OM retains 10k tokens where conventional compaction retains 5k, an additional 100 foreground calls read **500k extra cached tokens**: $0.05 at the illustrative cached price, or `0.5 × the foreground cached-input price per million`. The first fresh rendering and any recaching are additional. Conversely, a shorter OM projection would save that cost. This calculation does not assume either method actually has those lengths.

OM also produces memory before knowing whether the session will ever need compaction. A short session can incur observation/reflection cost while on-demand self-summary incurs none. Background production buys readiness and avoids a large summarization pause, but is not free compression.

## Takeaway

Explicit recall is very rarely exercised here. The economic reason to choose OM would need to be better summaries, source auditability when it matters, or smoother compaction—not cheap retrieval-driven context management. A cheap on-demand summarizer is the natural cost baseline. Quality equivalence remains untested; the [boundary audit](coherence/README.md) did not establish a winner.
