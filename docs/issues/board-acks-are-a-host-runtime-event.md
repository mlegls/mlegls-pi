---
stage: idea
assignee: agent
author: "session:01a0dd4f-a25f-7035-8329-77eb209b4461"
priority: 4
---

Dispatch guidance tells workers to `await board.read(...)` then `await board.ack(ids)` for handled messages, but `lib/board.ts` re-exports only `{logSize, meta, read, readFrom, send, topics, waitFor}`. Acknowledgment is `acknowledge()` inside `lib/board/host.ts` — wired to the agent runtime's `board:seen` event, which records the reader's delivery state in the pi session's entries. A worker driving only from bash (this run: `bring-the-application-to-the-2026-09-26-design-review`) can read and its reads land in `reads.jsonl`, but it cannot ack, so delivery bookkeeping shows the messages pending forever and the guidance is unachievable from that mode.

what done looks like: either board.ts exposes an `ack(ids)` usable from bash scripts (appending the read event and the seen record without a pi session), or dispatch's ack instruction is scoped to exec-mode workers only.

2026-09-26 observation from [[projects/concept/issues/charge-managed-turns-through-the-convex-ai-gateway]]: this worker exposed only `functions.bash`; no exec namespace or board API was available. It therefore could not call `board.read` or `board.ack` before changing the shared billing/provider seams. Peer coordination messages could not be inspected in this session.

2026-09-27, session `01a0e266-3000-7536-a02e-2aa2fba87b00`, reviewing `pipedemo/add-slug`: `ab lib board read '{"topic":"loop-all/*"}'` successfully returned peer messages. `ab lib board ack '["mujo9t1o-sctt7t","mujoakl0-con2kc"]'` failed with `board.ack is not a function`; listing exports confirmed no ack. Workaround: inspected the messages and continued the isolated review without acknowledgment. Reading works through the library adapter despite its help warning; acknowledgment remains unavailable in bash mode.

The same failure recurred in `dsh-templated-spawn-and-dispatch-review-1` (session `01a0e2ef-8677-770f-9786-512e6a6d3bc7`): `ab lib board read` returned `dsh-port/*` peers, while `ab lib board ack` rejected the six handled IDs. Continued the isolated review after reading; no acknowledgment workaround was available.

Root review of `dsh-port` hit the same adapter limit: `ab lib board read` returned peer decisions, but `ab lib board ack` failed with `board.ack is not a function`. Workaround: read the decisions and continued in the isolated review worktree; no durable acknowledgment was possible from bash.

2026-09-27, session `01a0e3cd-0adb-74c8-ab96-16e62a692b1a`, reviewing Concept's repository rename: `ab lib board read` returned both peer packets; `ab lib board ack` failed with `board.ack is not a function`. Read the packets and continued isolated review; no acknowledgment workaround. The unrelated `board` executable exposes issue operations, not peer coordination.

2026-09-27, Concept consolidation `loop-all-join-muk2rc0d-consolidate`: `ab lib board read` returned peer reviews, but `ab lib board ack '["muk2jl5q-dxup8h","muk2ququ-bt38wh"]'` failed with `board.ack is not a function`. Inspected the relevant reviews and continued the isolated structural pass without acknowledgment.

2026-09-28, Concept `quiet-the-transcript-machinery-review-1`: `ab lib board read` returned both peer packets; `ab lib board ack` failed with `board.ack is not a function`. Inspected the packets and continued in the isolated worktree without acknowledgment.

2026-09-28, Concept `refused-stale-acceptance-leaves-the-card-staged-review-1`: `ab lib board read` returned three peer messages; `ab lib board ack` failed with `board.ack is not a function`. Listing the module exports confirmed acknowledgment is unavailable. Workaround: read the peer packets and continue isolated review without acknowledgment.

2026-09-28, Concept `update-the-report-a-problem-guide-for-the-profile-menu-review-1`: `ab lib board read` returned the three peer packets; `ab lib board ack` failed with `board.ack is not a function`. Read the packets and continued isolated review without acknowledgment.

2026-09-28, Concept `settings-saved-confirmation-never-appears-review-1`: `ab lib board read` returned all three peer packets; `ab lib board ack` failed with `board.ack is not a function`. Read the packets and continued isolated review without acknowledgment.

2026-09-28, Concept `show-safe-material-lineage-in-published-captures-review-1`: `ab lib board read` returned both peer packets; `ab lib board ack` failed with `board.ack is not a function`. Listing exports confirmed no acknowledgment operation. Read the packets and continued isolated review without acknowledgment.

2026-09-28, Concept `capture-and-publish-mission-suggestion-metadata`, session `01a0e941-6e21-7664-ac0b-969f780e44d6`: `ab lib board read` returned the three parent packets, while `ab lib board ack` failed with `board.ack is not a function`. Listing exports confirmed no ack. Read the packets and published the implemented interface through `board.send`; acknowledgment remains unavailable from bash.
