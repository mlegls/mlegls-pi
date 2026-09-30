---
stage: done
assignee: agent
author: session:01a0e1a4-3d08-7254-a111-e7468d67a03e
part-of: "[[projects/mlegls-pi/issues/archive/dsh-port]]"
---

The skim/attention layer from `lib/skim.ts` and `lib/ingress.ts`, applied to what reaches the model in dsh. In PTC the model already chooses what it prints, so split it:

- automatic budget skimming when a `run_code` result (logs + value) is over budget: `tools/post-execute` or `finalizeContent` on `run_code`
- an explicit `skim(text, focus)` tool the program can call, so `focus` is an argument in code rather than a tool-call parameter
- full text stored outside context with a locator, i.e. the `ing-…` recall id. The pinned npm distribution supplies `@deepseek-ai/dsh-spill` and `@deepseek-ai/dsh-spill-local`; its abstract store only writes and returns a locator, so the overlay maps live-agent ids to local spill refs for retrieval.
- skimming in place of `compaction-tool-result-pruner`'s truncation of old results

Done when an over-budget `run_code` result comes back skimmed with a locator that a later program can pull verbatim, and an explicit `skim` call works inside a program. Whether skimming degrades anything is a separate question: [[projects/mlegls-pi/issues/skim-friction-vs-savings]].

## Result

The dsh overlay registers top-level `skim` and the local spill backend. Successful
`run_code` results over 4 KiB pass through `lib/ingress` before compaction; PTC
programs can call `tools.skim` and recover returned `ing-…` pages with `tools.pull`.
Locator mappings are ignorable session records backed by the dsh spill store.
They survive reload and fork until the spill backend's files expire.

Root review forced the SHA-256 fallback with a 168,019-character diff, recovered it
exactly, printed an 11,000-character slice without another skim/spill, then restarted
the process and recovered the same locator again. The stock spill policy and
old-result pruner are disabled so ingress sees originals, not their previews.

Live verification used the committed headless skim overlay and DeepSeek provider
patch with `DEEPSEEK_API_KEY`. In one real PTC program, `tools.skim` returned an id
and nested `tools.pull` returned an exact substring of its source
(`explicitPageExact: true`). That page was archived background and correctly did
not contain the active marker. The same program printed an oversized report; the
post-execute hook returned an `ing-…` omission locator. A later `run_code` pulled it
and verified the unique marker and a complete report section (`containsMarker: true`,
`containsFullSection: true`, 34,777 chars). This exercised the real local spill
service across PTC cells.

Verification: `bun-axi test lib/ingress.test.ts` passed all 5 tests; focused strict
TypeScript checking and the dsh plugin build passed. The live `deepseek-flash`
headless turn, provider setup, and headless-specific overlay are documented in
`dsh/README.md`. The separate Web hashline overlay was not model-driven here.

## Verification evidence

[Encounter and evidence](../attachments/dsh-skim-run-code-results/index.md).

[Combined-overlay repair and replay evidence](../attachments/dsh-port-root-review/index.md).
