# Caveman prose compression — 2026-09-22

Standalone Jev experiment at starting revision ced98e0. No ingress behavior changed.
Question: can one parallel keep/drop judgment per word produce a cheap, useful
telegraphic rendering? This is deletion-based sentence compression, related to
LLMLingua-2's token-level prompt compression.

## Run

Requires Bun and JEV_API_KEY, using the direct TypeSafe endpoint:

~~~sh
bun docs/research/caveman/run.ts > /tmp/indexed.json
CAVEMAN_MARKED=1 bun docs/research/caveman/run.ts > /tmp/marked.json
# Optional UTF-8 prose instead of the three built-in examples:
CAVEMAN_MARKED=1 bun docs/research/caveman/run.ts /tmp/prose.txt
~~~

The script asks every word's Noul in one request, assembles survivors at .35/.5/.65,
then checks all three candidates in another request for faithfulness, completeness,
and readability. Source sentence endings are restored when their word was removed;
otherwise it only deletes whitespace-delimited words. It prints raw candidates,
not a production-selected or fallback rendering. Sentence segmentation and attached
punctuation are deliberately rudimentary. Each source is one request; long files
may exceed API limits. No chunking, retries, service abstraction, or ingress wiring.

Model: jev-1.13.0. Price estimate: $0.042/M input tokens; output free, per the
[current model docs](https://docs.typesafe.ai/models). Actual usage comes from API
responses. Raw run output includes inputs, questions and responses. The checked-in
indexed.json and marked.json omit reconstructible request bodies but retain all
answers, candidates, usage and timings. Run.ts reconstructs the request questions.

## Encounter

Three sources: an ingress engineering update (69 whitespace-delimited words),
receipt/cancellation conditions (45), and qualified medical pilot results (39).
No prompt was tuned separately for a source.

Indexed mode supplies arrays of words and references individual indices. Marked
mode supplies continuous source text and repeats each target's sentence with its
word bracketed. It also explicitly distinguishes content words, identifiers and
relations from grammatical scaffolding: this is a combined prompting/representation
change, not an isolated test of indexing.

| Mode/source | Selection input tokens | Selection ms | Words kept at .5 | Check input tokens | Check ms |
| --- | ---: | ---: | ---: | ---: | ---: |
| Indexed/update | 2,888 | 2,168 | 56/69 | 1,040 | 895 |
| Indexed/conditions | 1,969 | 324 | 36/45 | 888 | 1,375 |
| Indexed/pilot | 1,788 | 378 | 33/39 | 899 | 317 |
| Marked/update | 6,155 | 2,244 | 59/69 | 1,057 | 488 |
| Marked/conditions | 3,529 | 1,100 | 33/45 | 885 | 312 |
| Marked/pilot | 3,278 | 292 | 29/39 | 894 | 340 |

Marked update cost: $0.00025851 selection + $0.000044394 checking all three
candidates = $0.000302904, about $0.30 per thousand such runs. Word savings are
not tokenizer savings. One observation per configuration; latency is not a benchmark.

## What actually happened

- Indexed .5 dropped the update's {focus} and Jev while keeping actually. At .65
  it left a dangling object” quote and removed the claim that the bug was fixed.
- Marked .5 preserved {focus} and Jev, but still deleted the entire Fixed. sentence.
  It saved only 14.5% of words. Raising to .65 saved 26.1%, with worse sentence links.
- Marked conditions .65 saved 35.6% and was recognizably telegraphic:
  “request not cancelled. client or server must retain receipt; both may retain it,
  must not both delete it. Retry only server not acknowledged write. timeout not
  prove write failed.” The condition is recoverable, but readability depends on
  the reader supplying grammar.
- Marked pilot .5 turned Five of the twelve into Five twelve. The checker still
  returned .89 for faithfulness and .89 for readability. It is not a reliable
  independent safety certificate; the same model may share the selector's blindness.
- Low-threshold output was often nearly unchanged. High-threshold output could
  remove indispensable objects and qualifications before removing filler.

Cost is viable. This simple wordwise ranking is not ready to replace ingress skims.
Better candidates would constrain related spans (quantities, quotations, named
entities, conditionals) together, or select among complete sentence compressions.
Those are follow-up hypotheses, not results established here. The experiment also
cannot establish whether joint deletion or individual judgment errors dominate.

Prototype checks: successful live runs of both modes (12 requests total), Bun build,
and git diff --check. Interactive review of the recorded output is the acceptance
surface; no production regression assertions or automatic fallback gate were added.

## Local-model follow-up

[LLMLingua-2 comparison](LLMLINGUA.md): existing token-compression models, local CPU/MPS inference, and the same failure probes.

[Focus-dependent retention replay](RETENTION.md): Jev chooses full / 75 / 50 / 25 / omit, then LLMLingua compresses only selected skims.
