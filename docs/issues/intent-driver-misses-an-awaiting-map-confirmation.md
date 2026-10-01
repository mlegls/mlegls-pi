---
stage: idea
author: session:01a0f537-9a22-71da-99c2-57f6b29620c0
---

During [[projects/concept/attachments/keep-confirmation-cards-to-their-own-state/index|the Confirmation first-use drive]], `ab computer` (owner: `mlegls-pi` computer browser runner / Jev decision model) sent `/charting` from Me and reached a new Session with **Change the map?**, **AWAITING YOU**, **Accept**, and **Decline**. Its requested end state was “An awaiting graph-change Confirmation with Accept and Decline is visible in a new Session”. It waited repeatedly, opened the unrelated unchanged “Open a side Session” Node twice, then stopped with `Until never showed while waiting`. A fresh Chrome accessibility snapshot contained all four expected labels. The preceding `/charting` drive in another Session completed with nearly the same end state, without “in a new Session”.

Workaround: inspect fresh state, confirm the already-delivered learner message and pending proposal, and continue with deterministic browser actions rather than replaying the send. The exclusively owned browser was retained by a project-owned `--browser` adapter; no mutations were blindly retried. Observation only: it is not established whether “graph” versus the rendered “map”, visibility at 800 × 600, the new-Session qualifier, or judgment instability caused the miss.

Related owner: [[projects/mlegls-pi/issues/computer-browser-judgment-confuses-node-chips-with-selected-card]]. A later drive with “A pending map-change Confirmation is visible” also waited repeatedly and stopped at the live `/overlap propose` card. Raw session-local traces: `2026-10-01T02-11-53-516Z-222ffb.browser.jsonl` and `2026-10-01T02-14-10-300Z-9da883.browser.jsonl`, session `01a0f537-9a22-71da-99c2-57f6b29620c0`; durable screenshots and actions are in the linked packet.
