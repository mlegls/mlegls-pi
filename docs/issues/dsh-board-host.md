---
stage: done
assignee: agent
author: session:01a0e1a4-3d08-7254-a111-e7468d67a03e
part-of: "[[projects/mlegls-pi/issues/dsh-port]]"
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

## Result — 2026-09-27

`dsh/board/index.ts` ports pi's board host to a Cordis plugin using the shared append-only store. It registers send/read/list/subscribe/ack tools; projects subscriptions, cursor, pending messages and seen IDs into ignorable session events; queues cancellable `Agent.followup()` notices; delivers quiet notices at `agent/pre-step`; and reports started, turn-end, exited and crashed events. Persistence transitions await `ctx.sessions.flush()`.

Each DSH session derives its mailbox from `agent.session.id` and scopes from its own session `cwd`. It does not use the process-level `PI_BOARD_TOPIC`, `PI_BOARD_NAME` or `PI_WM_*` identity, which belongs to pi's one-process/one-session model. Launch DSH Web with those six variables unset; the fake-host regression sets conflicting Pi values and checks two DSH sessions still use their own mailboxes. The Web startup identity issue was re-driven: this session's lifecycle reports now land on `mail/368f7f37`, with no later reports sent to `dsh-port/dsh-board-host`.

The local `dsh-session` ignorable append patch and Bun lock metadata are included (`0334ad3`, `8e55fbe`); `bbda57f`'s board-record validation fix is also an ancestor of this branch.

### First-use acceptance

Anonymous-local dsh Web ran against this checkout in isolated `dsh/.local/board-host-verify`, with the Hashline PTC preset and the available provider key supplied via environment. No token or credential is recorded. See [`dsh/board/verification/README.md`](../../dsh/board/verification/README.md) for the launch command and verifier overlays.

- Pi post `mujr6m82-eqte44` woke the idle DSH session. DSH full-read and acknowledged it, then replied to the Pi mailbox with `dsh-received:pi-to-dsh:identity-fix-idle-wake:1790513642` (`mujr6qhu-e4v9ve`).
- While busy in `sleep 10`, DSH full-read and acknowledged the subscribed message `mujpp3kh-t957pc`; its queued wake was retracted and no extra turn followed.
- After Web restart, the persisted `resume` subscription woke the session for Pi post `mujqbwq2-srtib8`. DSH full-read it and replied with the exact body prefixed `dsh-received:` (`mujqnt1w-12fhep`).
- The child-disposal path used one background `subagent` (`subagent-2`): child session `997b0837-b9fa-4384-9898-bbb100b048ea` subscribed, posted readiness message `mujr09h9-euea1u`, then was killed with `job_kill`. `job_output` settled as `killed`; the derived child mailbox `mail/00b048ea` contained `started`, `turn-end (aborted)`, and `exited` from that same session. The `exited` message is `mujr0dy3-hk1lrn`.

### Checks

- `bun-axi test board/index.test.ts` from `dsh/` passed. The fake host covers shared-store traffic, wake/retraction, quiet delivery, session-local identity under conflicting Pi environment, lifecycle reports, projection replay and ignorable append options.
- `bun-axi run build --cwd dsh` passed and rebuilt all four plugins.
- Focused strict TypeScript check passed for `dsh/board/index.ts` with Node types loaded.
- `bun test lib/board` passed (21 tests) earlier on this branch.

### Verification friction

The first Web launch inherited pi's `PI_BOARD_TOPIC`, so DSH lifecycle reports went to the pi worktree topic. The verifier now starts via `env -u PI_BOARD_TOPIC -u PI_BOARD_NAME -u PI_WM_RUN -u PI_WM_HANDLE -u PI_WM_AGENT -u PI_WM_PARENT_SESSION`, and the plugin routes per DSH Session ID rather than process environment. The initial `sleep 90` child timed out naturally before a kill; the acceptance run used `sleep 600` and killed it promptly, distinguishing cancellation from normal disposal.

A prior Web shutdown with a live child emitted an uncaught `projection registration is not active` error during cancellation. The `job_kill` child-disposal acceptance above passed; Web shutdown while a child is active remains unverified.

Fresh verifier packet: [`docs/attachments/dsh-board-host/index.md`](../attachments/dsh-board-host/index.md).

### Fresh verifier run

A fresh local encounter has now confirmed all three required stories against this checkout. Pi and DSH posted in both directions on one shared topic; a real Web session completed a turn, sat idle on a wake subscription, and then rendered the exact Pi post in its next turn; and one subscribed child produced `started`, an aborted `turn-end`, and `exited` on its own mailbox after cancellation. The API surface in this headless DSH profile returned a continuable subagent, not a job, so `job_kill` could not target it; `interrupt_agent` cancelled that child and the full mailbox readback confirmed its lifecycle. The independent setup, exact bodies, readbacks, captions and screenshots are in [`docs/attachments/dsh-board-host/index.md`](../attachments/dsh-board-host/index.md).

## Verification evidence

[Encounter and evidence](../attachments/dsh-board-host/index.md).

[Root integration review](../attachments/dsh-port-root-review/index.md) adds fork
identity/reset and malformed-record regressions; shared-store exchange was re-driven.
Shutdown with a live child belongs to
[[projects/mlegls-pi/issues/dsh-web-shutdown-inbox-projection-order]].
