# dsh templated spawn and dispatch — drive

Revision: `f36ed485c4007aebc7539e6fcc4e5ac4d4473414` (drive branch base).

Setup: fresh checkout-owned Web home `dsh/.local/dispatch-verify-drive`; workspace registered from this checkout; DeepSeek provider via inherited API-key auth (secret omitted); fresh parent/probe state. Entry: `bash dsh/dispatch/run.sh web --patch "$DSH_HOME/driver.yml" --no-open --host 127.0.0.1 --port 0`. Web became ready on loopback; private login token intentionally omitted. Setup/build completed with `bun run setup` and `bun run --cwd dsh setup`.

Probe: `dsh/dispatch/verification/README.md`, using its real-host `driver.js` and PTC program. At 12:53:17Z the parent returned three handles from `Promise.all` while idle, before children settled. Research was auto-routed to `dispatch-research` (DeepSeek Flash, low), read `package.json` and reported `mlegls-pi`; parent woke on settlement and independently read its `mail/f2a4bbdd` topic. Fill was routed to `dispatch-fill`; returned a worktree cwd/branch and successfully ran `pwd; git rev-parse HEAD` without edits. Deliberately failing pre-step generated a `crashed` mailbox event and settlement notice; independently read `mail/001e7460`. Board results include turn-end/exited in the research and fill mailboxes.

| Claim | Outcome | Evidence |
|---|---|---|
| Preset-routed child spawned programmatically, reported by board, parent woke and read result | held | probe log/session archive and `mail/f2a4bbdd` |
| Crashed child surfaced as monitor event | held | `mail/001e7460` contains `crashed`, error turn-end, exited |
| Spawn returns before completion and writer gets separate worktree | held | probe handles had `idle: true`; fill cwd/branch and successful shell output |

Frictions: SOCKS-style inherited `all_proxy` is unsupported and dsh connected directly; harmless warning. Fresh home required stopping the initial host to register the workspace and restarting with the driver patch. Expectations: dispatch should return handles without waiting; observed. A crash should be visible in the child's board topic and wake parent; observed. The settlement wake and board notice co-occurred, so board-only wake is not isolated. Host-process-death monitoring, concurrency saturation, cold continuation and write commits were not tested. No UI journey/screenshots.

The committed live probe itself is the executable black-box test; see `dsh/dispatch/verification/README.md`. Raw log and archives remain in ignored checkout-local `dsh/.local/dispatch-verify-drive/` and are not in this packet.
