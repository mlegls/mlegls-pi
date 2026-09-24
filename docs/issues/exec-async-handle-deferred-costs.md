---
stage: idea
author: session:2026-09-24T07-05-04-311Z_01a0d23b-6a37-75f1-bad0-4832beff35f3
---

Moved from `docs/frictions.md`: "Exec results are asynchronous by output handle (`cN.k`), with deferred costs. Late-output novelty is judged from the last six user/assistant messages, without tool-result bodies: a result observed only in a tool result, or handled long ago, is judged new and wakes the agent (the safe direction). One live probe put a superseded flaky run at 0.77, just under the 0.8 quiet threshold. The live trace stops updating once a cell yields. A synchronous loop in one cell blocks all concurrent cells until an interrupt's 1s ping resets the kernel. Reading `state` that a running cell is still writing is a race (`wait` on its handle first). Handles do not survive a kernel reset (`wait` reports an unknown handle). A cell with no `show` still reports `cN running` when it outlasts the yield. `show.pull` accepts both handles and ingress `ing-` ids, but they remain separate address spaces. `exec-output` follow-ups have no custom renderer."
