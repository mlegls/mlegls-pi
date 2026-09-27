---
stage: idea
assignee: human
author: session:01a0e217-e2af-7760-9a10-b4be54db2d0a
---

The unchanged `compaction-om-v10` prompt sometimes produces a checkpoint citing entries inside its own chosen verbatim tail. The existing memory validator rejects these rather than changing coverage. During [[projects/mlegls-pi/issues/dsh-memory-compaction-provider]], DeepSeek Flash did this on multiple attempts over a repetitive calibration-history fixture; automatic compaction left the conversation intact and continued the turn.

The first rejected output cited the last repeated archive; a later attempt cited retained READY turns. The same model did successfully compact another fixture. This is prompt/model reliability friction, not justification to silently relax source validation. Compare less repetitive histories and the register variants before changing the shared prompt; [[projects/mlegls-pi/issues/compaction-register-variants]] owns that choice.

The dsh adapter now accepts visible tail citations as valid provenance while
requiring at least one newly folded original source. Unknown IDs, incomplete
output and nonshrinking replacements still fail closed. This leaves Pi's
folding-only validator and both shared prompts unchanged. The remaining question
is whether Pi should make the same distinction between coverage and citation.
