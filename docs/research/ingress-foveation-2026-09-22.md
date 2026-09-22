# Foveated ingress — 2026-09-22

Starting revision: 54abdc5. Surface: a fresh exec Kernel, reader profile, fs enabled,
with live Jev and the implicit query "We are improving foveated reading in exec."
The reader wanted a peripheral architectural understanding, then exact evidence
before editing. Guide: [Exec ingress](../ingress.md).

## Encounter

The same anchored lib/ingress.ts source was read through:

~~~ts
await show(await read("lib/ingress.ts"), {focus:"understand the ingress architecture; skim operational details"});
await show(await read("lib/ingress.ts"), {focus:"inspect the filter implementation before editing budget handling"});
await show.pull(idFromFirstRead);
await show.raw("source", {focus:"literal object"});
await show("source", "trailing string");
~~~

Initially both reads behaved alike: a same-realm prototype identity check rejected
options constructed in the exec VM, silently discarding focus. The options parser
now recognizes the reserved one-key shape across realms. On the recorded rerun:

| Reading | Input bytes | Output bytes | Judgment + render ms |
| --- | ---: | ---: | ---: |
| Architecture | 15,971 | 5,278 | 1,025 |
| Inspect before editing | 15,971 | 15,971 | 499 |

Skims contained exact anchored excerpts and recovery handles. Pull returned the
full corresponding source passage. Raw displayed the focus-shaped object literally;
the old trailing-string call still displayed both values.

A library layout probe used a cancellation document with a tiny Related heading,
exact cancellation evidence, and two long historical sections. Tiny headings stayed
verbatim, the two historical sections shared one expansion handle, and exact evidence
survived an intentionally insufficient budget. Repeated ancestor headings within
the omitted run were noticed and deduplicated.

## Reviewed replay

- extensions/exec/fixtures/ingress-reading.json retains the live anchored source,
  implicit query, both focus strings, decisions, byte counts and latencies.
- lib/ingress.test.ts replays those decisions through the real chunker/renderer,
  checks exact source expansion, net savings, no-loss inspection, budget reasons,
  tiny-heading overhead, grouping and fail-open behavior.
- extensions/exec/ingress.test.ts drives a fresh exec VM with a recording ingress
  adapter. It checks focus plus implicit context, focus without context, default
  reading, large, raw, pull, variadic strings, and content blocks. This specifically
  protects the cross-realm affordance that failed during first use.

Run: bun test lib/ingress.test.ts extensions/exec/ingress.test.ts

The replay fixes decisions for determinism; it does not assert future model outputs
or service latency. Live inspection was conservative enough to retain the entire
file. Extraction remains a single contiguous excerpt plus structural context,
not an abstractive gist. Broader task accuracy and calibrated fidelity thresholds
remain unmeasured. Full replay inputs increase local session storage.

## Checks

- Full regression: env -u BB_THREAD_ID bun test — 208 pass, 1 skip, 0 fail.
- TypeScript: passed with a temporary config resolving the already-installed mise
  TypeScript package; the repository itself does not install that lint dependency.
- Jev span lint: reviewed advisory test-internal warnings. The flagged replay records,
  budget reasons, expansion handles and byte counts are intentional observable
  contracts of the importing reader and its evaluation surface.
- git diff --check: clean.
