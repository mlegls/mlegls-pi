# Five-level ingress integration — 2026-09-22

## First use

The real exec Kernel was driven through show(source, {focus}), show.pull(id), and
show.raw(source), using the four source passages from the standalone LLMLingua
probe. These include a historical version of the reading policy, not current docs.
Jev and the pinned local XLM-R-large checkpoint both ran live. The Jev connection
was explicitly warmed first with a 60-second allowance because the previously
measured local resolver delay exceeds ingress's normal eight-second deadline.
This validates the warm service path, not a repair of cold networking.

The accepted recording is extensions/exec/fixtures/ingress-retention.json.
It retains inputs, actual judgments, compressed previews, rendered exec output,
exact pulls and raw output. Replay it offline with:

~~~sh
bun test lib/ingress-retention.test.ts lib/ingress.test.ts extensions/exec/ingress.test.ts
~~~

The first suite substitutes the captured Jev and compression responses at the
reader boundaries. The exec VM suite exercises focus/raw/variadic compatibility.
The live encounter, not the offline replay, establishes that the actual Python
worker and checkpoint could be reached through exec.

## Observations

Source size: 3,486 UTF-8 bytes. Output sizes below exclude exec's final newline.

| Reading | Observed decision | Output bytes | Whole exec cell |
|---|---|---:|---:|
| Browse topics | all four passages at 25%, labeled non-assertive cues | 1,138 | 4,259 ms |
| Broad sketches | three passages at 50%, conditions omitted | 2,054 | 1,418 ms |
| Architecture | ingress and policy at 75%, others omitted | 2,624 | 1,139 ms |
| Decide retry | exact conditions, others omitted | 367 | 274 ms |

Browse pulls recovered all four originals. Raw reproduced the complete source.
The retry encounter retained both “Retry only if the server has not acknowledged
the write” and “A timeout does not prove that the write failed.” Labels, headings
and expansion handles are included in byte accounting. Code/anchored reading
continues to replay against the prior exact-excerpt encounter.

The first drive classified a line ending with a prose semicolon as code, sending
the whole policy passage down the excerpt path. That overly broad check was removed
and the sequence was driven again; the accepted fixture is the second drive.

A first standalone worker startup exceeded the fifteen-second deadline. A direct
worker run then initialized and exited in 4.4 seconds. Subsequent bridge startup
plus one short compression took 5.9 seconds; its next two compressions took 309 ms
each. The model was reused, and dispose/reset left no skim worker running. The
explicit setup command succeeded using cached dependencies and checkpoint. Missing
or failed compression has an offline replay showing exact-excerpt fallback and
recoverable originals; no claim is made that startup always fits the deadline.

## Interpretation and limits

This is deliberately lossy attention. The 25% retry cues contain “request cancelled”
although the original says it was not cancelled. The label says these are not
assertions. At 75%, the policy skim again loses the negation in “filtering never
makes the text larger.” Incompleteness labeling does not make every misreading
self-evident; exact reading/pull remains necessary when the statement matters.

The gist request asked for each entry but Jev omitted the conditions entry. This
is a remaining selector-quality limitation, not a compressor failure. The replay
records that decision without treating it as evidence of complete notebook coverage.
No universal semantic accuracy, miss rate, or end-to-end task benefit is established
by these four encounters. The earlier standalone [retention replay](caveman/RETENTION.md)
and [transport investigation](caveman/INVESTIGATION.md) remain relevant.

The integration keeps the modal retention choice even at low winning probability;
it does not equate uncertainty between adjacent rates with a need for verbatim text.
Structured evidence uses exact excerpts rather than token deletion. At all levels,
original values and pull remain exact, and unsuccessful byte savings revert to the
original display. Production changes do not modify Jev transport or system DNS.

## Checks and change size

Full bun test: 211 passed, one existing skip, zero failures (1,962 assertions).
TypeScript passed with a temporary config mapping the already-installed mise
TypeScript package; the repository still lacks its own TypeScript lint dependency.
Semantic lint reviewed 29 changed spans and raised 12 advisory test-detail flags;
these refer to the captured-input, rendering, and recovery contracts checked by
the replay. git diff --check passed.

Relative to b65fa9c, production TypeScript/Python grows by 171 lines net, mainly
the local worker and its protocol bridge; the rest is docs, tests and the encounter
fixture. No network configuration or production Jev transport changed.
