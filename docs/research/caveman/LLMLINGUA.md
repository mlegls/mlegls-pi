# LLMLingua-2 local skim probe — 2026-09-22

A follow-up to the [wordwise Jev experiment](README.md). Starting revision: 38b325f.
Question: can an existing local compressor supply the skim representation while
Jev retains focus-dependent verbatim/skim/omit selection? No ingress code changed.

## Reproduce

~~~sh
uv run --python 3.12 docs/research/caveman/compare_llmlingua.py > /tmp/bert-cpu.json
DEVICE=mps PYTORCH_ENABLE_MPS_FALLBACK=1 \
  uv run --python 3.12 docs/research/caveman/compare_llmlingua.py > /tmp/bert-mps.json
MODEL=microsoft/llmlingua-2-xlm-roberta-large-meetingbank \
  uv run --python 3.12 docs/research/caveman/compare_llmlingua.py > /tmp/large-cpu.json
~~~

Dependencies use uv's script cache; checkpoints use the normal Hugging Face cache.
The first run downloads weights. No API credential or remote inference is used.
The probe disables model repository code execution, uses float32, and sets four CPU
threads. It exercises upstream PromptCompressor, not a reimplementation.

Sources: the same engineering update, receipt conditions, and qualified medical
pilot result as the Jev experiment, plus the Reading policy section of docs/ingress.md.
Requested retention is 75%, 50%, and 35%. Actual retained token counts differ.
The options follow the upstream example's punctuation/newline preservation and
add its built-in digit preservation. Context-level filtering is disabled: only the
proposed skim stage is under examination. No bespoke negation/identifier rules.

Each case/rate runs three times after a warm-up. Timings cover the compression call,
including tokenization and output reconstruction; MPS work is synchronized before
stopping the timer. These are interactive observations, not a controlled benchmark.
All token counts are the package's cl100k_base counts, not Pi's target-model counts.
Receipts preserve source text, actual output, versions, checkpoint revision, and
all three timings. Duplicate output-list fields and the package's GPT-4 price-saving
string are omitted from checked-in receipts.

## Small model: 177M parameters

On this Apple M4 Pro, warmed short reads took roughly 90–120 ms on CPU and 25–27 ms
on MPS. The 477-token policy section took roughly 170 ms on CPU and 50 ms on warmed
MPS; the first larger GPU shape took 413 ms. CPU and MPS produced identical text for
all twelve cases/rates. MPS model loading from cache took 4.2 seconds, excluding
Python/import startup, followed by a 0.8-second warm-up. A deployment would need a
persistent worker rather than loading the model for each show call.

At requested 75% retention, the engineering update fell from 91 to 64 tokens:

> first live drive caught integration bug exec objects cross VM boundary plain object prototype check discarded focus }. Fixed.
> focus reaching Jev same source read behaves differently architecture reading produced 5 KB sketch from 16 KB inspection before editing retained full source. Pulls recovered originals. capturing as replay tightening small - passage / notice behavior.

This is closer to a useful telegraphic skim than the generic Jev word votes, but it
breaks {focus}'s braces and loses roughly/exact. The policy read loses the Skim label
and mangles an API signature. Token reconstruction does not preserve source layout.

At requested 50% retention, the conditions example changes:

- Retry only if the server has **not** acknowledged the write → Retry if server acknowledged write.
- A timeout **does not** prove that the write failed → timeout prove write failed.

At 35%, The request was not cancelled becomes request cancelled. The pilot example
also loses qualifications and turns Five of the twelve into Five twelve. These are
meaning reversals, not merely incomplete grammar or omitted secondary details.

## Larger recommended model: 559M parameters

The XLM-RoBERTa-large checkpoint preserved identifier punctuation better. At 75%
retention the update was 67/91 tokens, and the short condition/pilot examples retained
most of their essential relations. The pilot preserved roughly, unlike small BERT.
Warm CPU inference took roughly 300–340 ms on short passages and 490–560 ms on the
policy section. These timings exclude the checkpoint download; load from the
prefetched local cache took 0.6 seconds. The large model was not tested on MPS.

But the real policy read at **75% retention** changed:

> UTF-8 bytes: successful filtering **never** makes the text larger.

into:

> UTF-8 bytes successful filtering makes text larger.

The same output lost the 4,000-character bound despite digit preservation being
enabled. The settings are heuristics, not guarantees. At 50% retention the condition
probe again changed a timeout does not prove failure into timeout prove write failed.
At 35%, still more relations and essential objects disappeared.

## Decision

Do not replace ingress skims with this token-deletion pipeline as-is. Compute and
local operation are viable; semantic reliability is the blocker. This conclusion
is about the tested visible-reading use, not a refutation of the paper's aggregate
QA benchmarks. Source-only vocabulary does not prevent a meaning reversal.

The next conservative comparison would select whole source sentences rather than
render a token-pruned sentence as though it asserted the original claim. Retaining
75% is not, by itself, a safety policy. Neither an additional compression stage nor
a negation-word allowlist was added to production.

## Limits

The library emits a tokenizer-length warning on the longer policy source, then
successfully completes its own chunked processing. Initial setup also exposed a
Python filename collision: the probe must not be named llmlingua.py, which shadows
the installed package. The runnable file is compare_llmlingua.py.

The rate sweep intentionally includes aggressive settings to expose the failure
boundary. These four passages do not establish aggregate downstream task accuracy.
A published task-agnostic compressor is not automatically a faithful visible skim,
and preserving original vocabulary does not guarantee preserving its assertions.

The large checkpoint’s Xet transfer slowed severely. It was fetched using resumable
HTTP ranges instead and SHA-256 verified against Hugging Face metadata before
loading: a33a153b2493bff6be06af6921e69de9c0d0bb6ff06fe5bbb68670ba8d980ae2.
Weights are in the standard cache, not this repository. Temporary range files were
removed after assembly. No local runtime workaround is required by the probe itself.

Checks: both checkpoints ran on CPU; BERT also ran on MPS, with identical outputs
across devices for all twelve settings. Three timings per case/rate and the source
outputs are retained. git diff --check passed. This is a reviewed prototype, not
a production integration or a statistically representative evaluation.
