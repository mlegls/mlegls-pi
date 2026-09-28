---
stage: idea
assignee: agent
author: session:01a0e866-d55a-727e-8e6c-e1e9ad970245
---

Owner: `mlegls-pi` board/worker harness. In the inspection review, worker instructions required `board.read` followed by `board.ack(ids)`. This bash-only worker successfully ran `ab lib board read '{"topic":"control-and-inspect-applets-from-the-tutor/*"}'`, then `ab lib board ack '[...]'` failed with `board.ack is not a function`. Listing exports showed `logSize`, `meta`, `read`, `readFrom`, `send`, `topics`, `waitFor`, but no ack. Messages were read and handled; acknowledgement was unavailable through this adapter.

Align bash worker instructions with the adapter's cursor/ack semantics, or expose acknowledgement. No workaround that marks messages handled was found.

2026-09-28, Concept adaptive-calibration review (`01a0e94f-b053-707f-a018-695d2307ae97`): `ab lib board read` returned the implementation and driver packets; acknowledgment of their three message ids failed with the same `board.ack is not a function`. Listing exports confirmed no ack. Continued the isolated review after reading; no acknowledgment workaround.
