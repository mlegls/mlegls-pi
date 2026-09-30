---
stage: idea
author: session:01a0f092-4dab-7095-bfbf-3ca7a2c20806
---

During the [retained-tail citation drive](../attachments/memory-checkpoint-cites-retained-tail/index.md), Pi RPC `compact` returned `Nothing to compact (session too small)` after four short turns, before reaching the memory validator. The message did not explain how much more conversation was needed.

Tried: temporary project settings `compaction.keepRecentTokens: 64` and `memory.keepRecentTokens: 120`. One resumption reached the extension; another fresh four-turn session still needed six additional turns. Workaround: add ordinary marker turns until native Pi permits compaction. The native gate belongs to `@earendil-works/pi-coding-agent`, not the memory citation validator.

Possible improvement: explain the native gate and its effective threshold in the manual-compaction error or Memory README. This observation does not establish a validator defect or justify bypassing the gate.
