---
stage: done
assignee: agent
author: session:01a0e866-d55a-727e-8e6c-e1e9ad970245
---

Owner: `mlegls-pi` board/worker harness. In the inspection review, worker instructions required `board.read` followed by `board.ack(ids)`. This bash-only worker successfully ran `ab lib board read '{"topic":"control-and-inspect-applets-from-the-tutor/*"}'`, then `ab lib board ack '[...]'` failed with `board.ack is not a function`. Listing exports showed `logSize`, `meta`, `read`, `readFrom`, `send`, `topics`, `waitFor`, but no ack. Messages were read and handled; acknowledgement was unavailable through this adapter.

2026-09-29, Concept edition consolidation (`01a0eeb2-107a-7696-873c-175434219389`): read all 17 parent-topic messages; `ab lib board ack '[]'` still failed with `board.ack is not a function`. Continued from the handled messages without acknowledgement.

Align bash worker instructions with the adapter's cursor/ack semantics, or expose acknowledgement. No workaround that marks messages handled was found.

2026-09-28, Concept feature-use journal review (`01a0e959-c271-713d-bda7-a4789d286477`): read the parent topic with `ab lib board read`; `ab lib board ack '[]'` still reports `board.ack is not a function`. Continued from the read messages; no acknowledgment workaround.
2026-09-28, Concept adaptive-calibration review (`01a0e94f-b053-707f-a018-695d2307ae97`): `ab lib board read` returned the implementation and driver packets; acknowledgment of their three message ids failed with the same `board.ack is not a function`. Listing exports confirmed no ack. Continued the isolated review after reading; no acknowledgment workaround.
2026-09-28, Concept official-publisher review (`01a0e99a-8e5d-712a-b3b6-8c44948a59d3`): the read returned three peer packets; `ab lib board ack` failed with `board.ack is not a function`. Continued from the read messages without acknowledgement.

2026-09-28, Concept account-operation review (`01a0e9a2-169f-72f1-9c2f-51bc610e9049`): read all 18 messages on the parent topic; `ab lib board ack` exited 2. Export discovery still has no ack. Used `send` for the preference-acceptance seam decision and continued without acknowledgment.

2026-09-28, Concept map/Hub review (`01a0e9b2-221b-71cd-912e-980175aac7bb`): `ab lib board read` returned peer decisions and packets; acknowledgment of two handled message IDs failed with `board.ack is not a function`. Continued isolated review without acknowledgment.

2026-09-29, Concept dependency-preparation review (`01a0eb50-57ed-74fc-9e00-14ab87341be3`): `ab lib board read` returned both peer packets, but acknowledging their IDs still failed with `board.ack is not a function`. Continued the isolated review from those packets; no acknowledgement workaround.

2026-09-29, Concept screenshot-packet review (`01a0eb54-19c0-769a-96b6-53d127a69c9f`): read both peer packets through `ab lib board read`; `ab lib board ack` again failed with `board.ack is not a function`. Export discovery confirmed no ack. Continued the isolated review from the read packets without acknowledgement.

2026-09-29, Concept scripted-provider review (`01a0eb61-6e41-70cc-a1dd-b8dd35926ce2`): read both peer packets; `ab lib board ack` failed with `board.ack is not a function`. Export discovery again has no ack. Continued from the handled messages without acknowledgement.

2026-09-29, Concept default-adoption review (`01a0eb70-c407-7595-b47e-e4ea003b9378`): read the implementation and drive packets; `ab lib board ack` failed with `board.ack is not a function`. Export discovery confirmed no ack. Continued from the handled messages without acknowledgement.

2026-09-29, Concept local-provider-proxy review (`01a0eba1-f10a-755a-a8e9-e4c2d71d6301`): read all three peer packets with `ab lib board read`; acknowledging their IDs failed with `board.ack is not a function`. Export discovery confirmed no ack. Continued the isolated review from the read packets without acknowledgement.

2026-09-29, Concept `/ncept/zh/` review (`01a0ebc3-8928-7678-afa8-cf098e678bc1`): read all five packets; `ab lib board ack` again failed with `board.ack is not a function`. Export listing confirmed no ack. Continued from the read packets without acknowledgement.

2026-09-29, Concept Mission-overview replay review (`01a0ebee-6ffb-75ea-a426-f87305076ebd`): read both peer packets; `ab lib board ack` failed with `board.ack is not a function`. Export listing confirmed no ack. Continued isolated review from the handled packets without acknowledgement.

2026-09-29, Concept variant-metadata review (`01a0ebfb-c0b3-75a5-bf0b-9f30834fd597`): read all three peer packets; `ab lib board ack` failed with `board.ack is not a function`. Continued the isolated review from those packets without acknowledgement.

2026-09-29, Concept contrast-control implementation (`01a0ed1f-66f2-74d8-8b36-5d921d1e17a0`): read all four parent messages using `ab lib board read`; `ab lib board ack` returned `board.ack is not a function`. Continued from the read messages and sent the shared input decision through `board.send`.

2026-09-29, Concept applet restart implementation (`01a0ed36-1a58-77ad-a960-37cc2d6cc3f0`): read three parent packets; `ab lib board ack` failed with `board.ack is not a function`. Export listing confirms no acknowledgement operation. Continued from the read packets.

2026-09-29, Concept contrast-control review (`01a0ed46-7665-7066-ac0b-5189a9734949`): peer read succeeded; `ab lib board ack` failed with `board.ack is not a function`. Continued from handled packets without acknowledgement.

2026-09-29, Concept applet restart review (`01a0ed4e-e262-74f1-b164-6a6a84f2b64f`): read all seven parent/peer messages. `ab lib board ack` with their IDs failed with `board.ack is not a function`; continued isolated review from the read packets without acknowledgement.

2026-09-29, Concept scheduled-work review (`01a0ed56-19e9-750d-a749-b707085b6bd9`): read all ten peer messages; `ab lib board ack` failed with `board.ack is not a function`. Continued from the handled packets without acknowledgement.

2026-09-29, Concept applet host-loss implementation (`01a0ed58-5bc5-76cf-8fea-5a9c531304b1`): read all nine peer messages; `ab lib board ack` failed with `board.ack is not a function`. Continued from the handled packets without acknowledgement.

2026-09-29, Concept visit-edition implementation (`01a0ed6a-655a-743b-90e5-445e4130eb87`): read all five parent packets; `ab lib board ack` failed with `board.ack is not a function`. Export listing confirms no ack. Continued from handled packets without acknowledgement.

2026-09-29, Concept host-loss review (`01a0ed74-87dc-746c-b237-2aaef0ee03c0`): read all 14 peer messages; acknowledging handled decision/drive IDs via `ab lib board ack` failed with `board.ack is not a function`. Continued isolated review from the read packets without acknowledgement.

2026-09-29, Concept usable-seed review (`01a0ed78-27e3-7608-aa58-58375487891c`): peer read succeeded; `ab lib board ack` failed with `board.ack is not a function`. Export discovery confirmed no ack. Continued isolated review from handled packets without acknowledgement.

2026-09-29, Concept transfer measurement review (`01a0eea2-b2b2-7667-b178-6db7ab82f57e`): read all 16 peer messages; acknowledging the implementer and driver IDs via `ab lib board ack` failed with `board.ack is not a function`. Continued from handled packets without acknowledgement.

2026-09-30, Concept joined contrast acceptance (`01a0f027-2b67-760e-a526-b1044e1de854`): read all 12 subtree messages; `ab lib board ack` with their IDs still failed with `board.ack is not a function`. Continued from handled packets without acknowledgement.

result, 2026-09-30: acknowledgement only settles subscription delivery inside a pi session, so a bash worker has nothing to acknowledge. `agents/_common.md` now gives the bash forms (`ab lib board read`, `ab lib board send` with `from`), says there is nothing to ack without exec, and names the PATH `board` as an unrelated tracker; `ab lib --help` no longer calls board host-bound.
