# dsh-board-host first-use verification

Tested `b70ab5d` plus verifier evidence commit `6bf9c22`. Setup: anonymous-local DSH Web, checkout-owned worktree `/Users/mlegls/dev/mlegls-pi__worktrees/dsh-board-host-verify`, isolated `dsh/.local/board-host-verify`, Hashline PTC preset, provider key supplied only by environment, and all six inherited Pi identity variables unset. The board store was the default shared `~/.local/share/pi-board`. DSH setup/build completed with `bun run --cwd dsh setup`; the Web listener bound loopback port 62026. The checkout was added to the workspace store with the `dsh/add-workspace.ts` helper from `main` and the Web process restarted to load it. The helper's change is in isolated local setup state only. No credentials or login token are recorded.

The headless setup and a fresh Web session both used this checkout's DSH code and store. Headless invocations exposed the board tools and executed them, though DSH logged a duplicate `read` tool registration warning from the Hashline plugin; this did not prevent board operations. Headless startup removed `PI_BOARD_TOPIC`, `PI_BOARD_NAME`, and four `PI_WM_*` selectors as required.

## Required claims

- **Pi and DSH exchange on one topic — held.** Pi posted `pi-to-dsh:first-use:nonce-5831` to `verify/dsh-board-host-20260927`; DSH read that exact body and replied `dsh-received:pi-to-dsh:first-use:nonce-5831`. Pi-side readback confirmed the reply. A further DSH session posted `dsh-to-pi:same-topic:nonce-7412` to the same topic; Pi-side full read showed both posts together (two messages, omitted 0). DSH's reply message ID was `mujse0kv-uubxfj`.
- **A subscribed idle DSH session wakes on Pi post — held.** A checkout-owned Web session subscribed with `wake:true`, returned `READY_FOR_IDLE_WAKE` and ended turn 1. Pi then posted `pi-post-idle-wake:nonce-9106`. The idle session began turn 2 and visibly displayed `Wake received for verify/dsh-board-host-20260927/idle: pi-post-idle-wake:nonce-9106`; its turn-end event is `mujscwu7-2iix0p`. Screenshots: [idle subscriber](01-idle-subscriber.png), [wake received](02-idle-wake-received.png).
- **Disposing a subscribed child reports lifecycle to its topic — held.** One background subagent subscribed with wake to `verify/dsh-board-host-20260927/child`, posted readiness as session `2fc7eaaf-22bb-4811-9fc2-a043685aa57e`, and blocked in a 600-second shell sleep. The subagent API returned a continuable child ID, not a `job_kill` job; `job_kill` rejected it as unknown job (`job_list` was empty). The actual child was cancelled with `interrupt_agent`; it became inactive. Full Pi-side readback of `mail/685aa57e` showed `started`, `turn-end` with `{kind: aborted, reason: parent}`, and `exited`, all from that child session (total 3, omitted 0). This verifies lifecycle reporting for child cancellation; the available DSH subagent-control surface does not expose the requested job-kill mechanism for this child kind.

## Evidence and cleanup

The images show the real DSH Web chat before and after the idle wake. The shared board readbacks are recorded above with unique message IDs and exact bodies. Web and the named browser session were stopped after the encounter; no Web listener remains. No implementation repair was needed.

## Root integration review

The [root packet](../dsh-port-root-review/index.md) re-drives shared-store sending
and adds regressions for malformed records and fork-local subscriptions. A fork
now resets inherited delivery state and retracts inherited board notices rather
than listening on its parent's mailbox. Same-session replay remains durable.
The Web images above establish the original idle-wake journey, not this new
backend fork regression. All three original stories remain **held**; the root
review did not repeat the unchanged child-monitor journey.
