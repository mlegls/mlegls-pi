---
stage: spec
assignee: agent
author: session:01a0e1a4-3d08-7254-a111-e7468d67a03e
part-of: "[[projects/mlegls-pi/issues/dsh-port]]"
blocked-by: ["[[projects/mlegls-pi/issues/dsh-hashline-tools-spike]]"]
---

The skim/attention layer from `lib/skim.ts` and `lib/ingress.ts`, applied to what reaches the model in dsh. In PTC the model already chooses what it prints, so split it:

- automatic budget skimming when a `run_code` result (logs + value) is over budget: `tools/post-execute` or `finalizeContent` on `run_code`
- an explicit `skim(text, focus)` tool the program can call, so `focus` is an argument in code rather than a tool-call parameter
- full text stored outside context with a locator, i.e. the `ing-…` recall id. dsh's `spill` family (`packages/spill`) already does this; use it rather than a second store.
- skimming in place of `compaction-tool-result-pruner`'s truncation of old results

Done when an over-budget `run_code` result comes back skimmed with a locator that a later program can pull verbatim, and an explicit `skim` call works inside a program. Whether skimming degrades anything is a separate question: [[projects/mlegls-pi/issues/skim-friction-vs-savings]].
