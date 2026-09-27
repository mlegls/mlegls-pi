---
stage: spec
assignee: agent
author: session:01a0e1a4-3d08-7254-a111-e7468d67a03e
part-of: "[[projects/mlegls-pi/issues/dsh-port]]"
blocked-by: ["[[projects/mlegls-pi/issues/dsh-hashline-tools-spike]]"]
---

Port the board's pi host (`lib/board/host.ts`, ~250 lines) to a Cordis plugin. `lib/board/store.ts` (the machine-wide append-only JSONL store), mailboxes and scopes don't depend on pi and are reused as they are, so pi and dsh sessions share one board.

| pi | dsh |
|---|---|
| `appendEntry` for subs/cursor/seen | session events with `ignorable: true` |
| `sendMessage(..., {deliverAs: "followUp", triggerTurn})` | `Agent.followup()` |
| `before_agent_start` injection | `agent/pre-step` |
| `agent_end` → report to your own topic | `turn/end` session event |
| `setInterval` poll | `ctx.setInterval` (cleaned up with the plugin) |
| `session_tree` restore | not needed; forks are new sessions |

`host.ts:150` only delivers when idle because pi's follow-up queue can't retract a notification the model already read through a tool. dsh's `agent/inbox/spliced` removes queued inbox messages, so retract instead.

Add monitor: the host posts lifecycle events (started, turn end, exited, crashed) to a session's own topic, so a crash is observable without the dead process announcing it. `agent-team`'s journal (`packages/experimental/agent-team/src/journal.ts`: durable mailboxes, delivered at most once, never lost) is the reference for durability semantics.

Done when a dsh session and a pi session exchange messages on a topic, a subscribed dsh session is woken by a post while idle, and killing a subscribed child shows up as an event on its topic.

## Implementation checkpoint — 2026-09-27

Implemented in `dsh/board/index.ts`: shared board send/read/list/subscribe/ack tools; per-session projected subscriptions, cursor, pending and seen state; queued `Agent.followup()` notices that can be retracted by a full `board_read` or `board_ack`; quiet delivery from `agent/pre-step`; and started, turn-end, exited and crashed reports. State and inbox transitions use `ctx.sessions.flush()` before they are treated as durable. The plugin is wired into the top-level overlay and `dsh` build; usage and the replay caveat are in `dsh/README.md`.

Checks run:
- Focused strict TypeScript check and dsh bundle build passed.
- `bun test dsh/board/index.test.ts` passed. Its fake Cordis host exercises shared-store pi-write/dsh-read, wake delivery and retraction, quiet pre-step delivery, report hooks, replay projection and ignorable append options.
- `bun test lib/board` passed (21 tests).
- An isolated anonymous-local dsh Web launch loaded the overlay and emitted a started report. I opened the local UI but did not invoke a board tool or send a model request; the Web process and disposable home are stopped/removed.

This is not acceptance-complete. The pinned dsh-session 0.1.7-rc.2 build silently drops `{ ignorable: true }`; the memory branch owns the patch and `patchedDependencies`/lock metadata, which are not present here. Do not rely on board state replay until that patch is integrated and an actual session resume is checked. The required live pi↔dsh exchange, idle wake, and disposal of a subscribed child were not exercised through dsh Web; the fake-host test is not a substitute. Main's board-record validation fix `bbda57f` is also not integrated on this branch and should be carried into the combined branch.
