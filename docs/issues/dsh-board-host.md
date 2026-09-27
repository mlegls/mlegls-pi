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
