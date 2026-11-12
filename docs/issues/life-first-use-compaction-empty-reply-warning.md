---
stage: "idea"
assignee: "agent"
author: "session:thr_3mb8axsh4t"
priority: 3
---
During independent CLI/RPC first use of [[projects/mlegls-pi/issues/life-session-attachment-and-run-context]], at b23e2014f46e42592eb10d2032c83fba5eec393d, a real Haiku 4.5 session on a freshly prepared shared temporary store emitted `life: compaction failed: empty reply` after a tool-heavy run with tailBytes 800. The request itself completed; no data loss was established. A subsequent sequential four-call run completed but took about three minutes, including a long pause after its fourth tool result. These are separate observations; their cause is unknown.

Reproduce with `bun scripts/life-playground.ts prepare`, start slot one with `--mode rpc`, ask for six bash outputs of 150 repeated words, then submit `/life`. The warning occurred in the first trial; a later four-call trial did not repeat it. Workaround: continue using the session; raising tailBytes to 1000000 allowed a controlled overlapping catch_up trial without prefix advancement. Evidence: [drive packet](../../docs/attachments/life-session-attachment-and-run-context/index.md). No implementation was inspected or changed.

Review observation: the long pause is explained and fixed (a stuck early leaf made each request wait waitSeconds; see [[projects/mlegls-pi/issues/life-compactor-lease-outlives-its-builder]]). The warning stays unexplained. In the driver's store leaf 37 (901 bytes of one repeated word) never got a node, and three later ones (64, 74, 90) also stayed unbuilt; a failed call keeps its own lease, so a failure there would also stall siblings for ten minutes. Replaying the leaf's prompt against Haiku 4.5 ten times, with the turn-style system prompt and tools declared and without, gave a reply every time, so the empty reply needs the live session's turn prompt/tools to reproduce. Waits on: capturing the failing call's stopReason (a tool call? a thinking-only reply at maxTokens 4000?) next time it occurs.
