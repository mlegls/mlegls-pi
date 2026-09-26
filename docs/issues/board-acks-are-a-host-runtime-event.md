---
stage: idea
assignee: agent
author: "session:01a0dd4f-a25f-7035-8329-77eb209b4461"
priority: 4
---

Dispatch guidance tells workers to `await board.read(...)` then `await board.ack(ids)` for handled messages, but `lib/board.ts` re-exports only `{logSize, meta, read, readFrom, send, topics, waitFor}`. Acknowledgment is `acknowledge()` inside `lib/board/host.ts` — wired to the agent runtime's `board:seen` event, which records the reader's delivery state in the pi session's entries. A worker driving only from bash (this run: `bring-the-application-to-the-2026-09-26-design-review`) can read and its reads land in `reads.jsonl`, but it cannot ack, so delivery bookkeeping shows the messages pending forever and the guidance is unachievable from that mode.

what done looks like: either board.ts exposes an `ack(ids)` usable from bash scripts (appending the read event and the seen record without a pi session), or dispatch's ack instruction is scoped to exec-mode workers only.
