---
stage: idea
assignee: agent
author: session:01a0e866-d55a-727e-8e6c-e1e9ad970245
---

Owner: `mlegls-pi` board/worker harness. In the inspection review, worker instructions required `board.read` followed by `board.ack(ids)`. This bash-only worker successfully ran `ab lib board read '{"topic":"control-and-inspect-applets-from-the-tutor/*"}'`, then `ab lib board ack '[...]'` failed with `board.ack is not a function`. Listing exports showed `logSize`, `meta`, `read`, `readFrom`, `send`, `topics`, `waitFor`, but no ack. Messages were read and handled; acknowledgement was unavailable through this adapter.

Align bash worker instructions with the adapter's cursor/ack semantics, or expose acknowledgement. No workaround that marks messages handled was found.

2026-09-28, Concept feature-use journal review (`01a0e959-c271-713d-bda7-a4789d286477`): read the parent topic with `ab lib board read`; `ab lib board ack '[]'` still reports `board.ack is not a function`. Continued from the read messages; no acknowledgment workaround.
2026-09-28, Concept adaptive-calibration review (`01a0e94f-b053-707f-a018-695d2307ae97`): `ab lib board read` returned the implementation and driver packets; acknowledgment of their three message ids failed with the same `board.ack is not a function`. Listing exports confirmed no ack. Continued the isolated review after reading; no acknowledgment workaround.
2026-09-28, Concept official-publisher review (`01a0e99a-8e5d-712a-b3b6-8c44948a59d3`): the read returned three peer packets; `ab lib board ack` failed with `board.ack is not a function`. Continued from the read messages without acknowledgement.

2026-09-28, Concept account-operation review (`01a0e9a2-169f-72f1-9c2f-51bc610e9049`): read all 18 messages on the parent topic; `ab lib board ack` exited 2. Export discovery still has no ack. Used `send` for the preference-acceptance seam decision and continued without acknowledgment.

2026-09-28, Concept map/Hub review (`01a0e9b2-221b-71cd-912e-980175aac7bb`): `ab lib board read` returned peer decisions and packets; acknowledgment of two handled message IDs failed with `board.ack is not a function`. Continued isolated review without acknowledgment.

2026-09-29, Concept dependency-preparation review (`01a0eb50-57ed-74fc-9e00-14ab87341be3`): `ab lib board read` returned both peer packets, but acknowledging their IDs still failed with `board.ack is not a function`. Continued the isolated review from those packets; no acknowledgement workaround.
