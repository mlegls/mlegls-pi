# dsh templated spawn and dispatch — drive

Revision: `f36ed485c4007aebc7539e6fcc4e5ac4d4473414` (drive branch base).

Setup: fresh checkout-owned Web home `dsh/.local/dispatch-verify-drive`; workspace registered from this checkout; DeepSeek provider via inherited API-key auth (secret omitted); fresh parent/probe state. Entry: `bash dsh/dispatch/run.sh web --patch "$DSH_HOME/driver.yml" --no-open --host 127.0.0.1 --port 0`. Web became ready on loopback; private login token intentionally omitted. Setup/build completed with `bun run setup` and `bun run --cwd dsh setup`.

Probe: `dsh/dispatch/verification/README.md`, using its real-host `driver.js` and PTC program. At 12:53:17Z the parent returned three handles from `Promise.all` while idle, before children settled. Research was routed with the explicit `agent:research` stance to `dispatch-research` (DeepSeek Flash, low), read `package.json` and reported `mlegls-pi`; parent woke on settlement and independently read its `mail/f2a4bbdd` topic. Fill was routed to `dispatch-fill`; returned a worktree cwd/branch and successfully ran `pwd; git rev-parse HEAD` without edits. Deliberately failing pre-step generated a `crashed` mailbox event and settlement notice; independently read `mail/001e7460`. Board results include turn-end/exited in the research and fill mailboxes. Unpinned stance classification was not exercised.

| Claim | Outcome | Evidence |
|---|---|---|
| Preset-routed child spawned programmatically, reported by board, parent woke and read result | held | [probe log](dispatch-probe.jsonl): handles at 12:53:17.297Z, parent running at .314Z, research board notice at 12:53:22.672Z; [parent excerpt](parent-excerpt.json) seq 29/65 |
| Crashed child surfaced as monitor event | held | [parent excerpt](parent-excerpt.json) seq 44: `mail/001e7460` contains crashed/error turn-end/exited; matches independently read shared board |
| Spawn returns before completion and writer gets separate worktree | held | [probe log](dispatch-probe.jsonl): handles precede gate release/error; fill handle and closing shell output |

Frictions: SOCKS-style inherited `all_proxy` is unsupported and dsh connected directly; harmless warning. Fresh home required stopping the initial host to register the workspace and restarting with the driver patch. Expectations: dispatch should return handles without waiting; observed. A crash should be visible in the child's board topic and wake parent; observed. The settlement wake and board notice co-occurred, so board-only wake is not isolated. Host-process-death monitoring, concurrency saturation, cold continuation and write commits were not tested. No UI journey/screenshots.

## Review

No runtime repair was needed. Recovered the driver's exact [probe log](dispatch-probe.jsonl) and selected original records from its compressed parent session as [parent-excerpt.json](parent-excerpt.json); these now survive worktree retirement. The excerpt selects only the session header, turn boundaries and completed PTC dispatches (including full board readbacks); record contents are unchanged. This is preserved driver evidence, not a new live run. Runtime code remains identical to the driven revision.

Driver test passed using the retained log:

```sh
DSH_DISPATCH_PROBE_LOG="$PWD/docs/attachments/dsh-templated-spawn-and-dispatch/dispatch-probe.jsonl" bun test dsh/dispatch/verification/dispatch-story.test.ts
```

Frozen install/build and route/dispatch/board regressions passed. Added a routing regression for preset defaults, explicit model pins, provider exclusions and roster fallback. Both driver expectations hold; settlement and board-only wake remain unseparated.

Friction disposition: proxy fallback is [a separate networking idea](../../issues/dsh-unsupported-socks-proxy-falls-back-to-direct.md); stop/register/restart belongs to [the existing workspace-launch issue](../../issues/dsh-web-default-workspace-outside-home.md). Review's unavailable bash acknowledgment is recorded in [the existing board adapter issue](../../issues/board-acks-are-a-host-runtime-event.md). No external processes were started by review.
