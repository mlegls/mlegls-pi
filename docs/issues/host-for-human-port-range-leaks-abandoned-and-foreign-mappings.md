---
stage: "ticket"
priority: 2
author: "session:01a19a74-4995-71d6-a961-c51d59747b8e"
assignee: "agent"
---
While reviewing [[projects/mlegls-pi/issues/serve-review-pages-over-tailscale-https-from-a-supervised-process]] on Beelink (2026-11-02), `tailscale serve status` showed HTTPS ports 10000, 10001 and 10003 held by non-host-for-human mappings (launch-video bridge, convex proxy, takes) and 10002 free. The earlier [[projects/mlegls-pi/issues/tailscale-review-https-range-is-full]] was the same shape: all four ports occupied, one by a mapping whose upstream (127.0.0.1:18174) refused connections, released by hand.

Observation: `bin/host-for-human` allocates only from 10000–10003, never touches mappings it did not create, and keeps a reservation in `~/.local/state/host-for-human/*.json` until `--stop`. Any one abandoned review page (no `--stop`) or dead foreign mapping permanently costs a port, and with three foreign mappings live a second concurrent review fails with "no free Tailscale HTTPS port in 10000–10003".

Decision it waits on: reclaim policy. Options: (a) reclaim host-for-human reservations whose directory is gone or whose service has been inactive past some age; (b) reclaim foreign mappings whose upstream refuses connections; (c) widen the mapped range; (d) move the launch-video mappings elsewhere. (b) removes other tools' state and needs the maintainer's call.

Efficiency audit 2026-11-05 (@thread:thr_pqt8kgvd8h): 10000, 10001 and 10003 still map to upstreams (4410, 3219, 4720) that answer nothing. The user asked 4–6 times in 11-02→11-05 for a review page to be re-served or restarted (@thread:thr_ihbpyrp6s2#msg=863, #msg=1977, @thread:thr_78sspagtst#msg=44566). Two causes beside the reclaim policy: (1) the 11-02 `universal.md` line naming `host-for-human` over `bb connect expose` never reached agents, because `agents-apply.sh` wasn't rerun; re-rendered 11-05, and `lib/doctor.ts` now reports stale renders (`6a31c482`). (2) In port mode `host-for-human` maps the port but doesn't own the upstream (the Lavish server), so a page dies with the worker's turn or a reboot; agents then hand-built systemd units. Owning the upstream command too (for example `host-for-human --run '<lavish-axi …>'`) would let a link outlive its worker.

Decision (maintainer, 2026-11-05, @thread:thr_pqt8kgvd8h): option (b): reclaim foreign mappings whose upstream refuses connections. Also make a review link outlive the worker that served it.

Ticket:
1. When allocating, `host-for-human` treats a mapping in 10000–10003 as free when its upstream refuses a TCP connection (it may remove mappings it did not create on that ground only), and names each one it removes on stderr. A foreign mapping whose upstream answers stays untouched.
2. It also reclaims its own reservations whose directory is gone or whose service is inactive.
3. `host-for-human --run '<command>' <port>` runs the upstream command as the same supervised user service as the mapping, so a Lavish page survives the worker's turn and a reboot, and `--stop` ends both.

Acceptance: with a scratch mapping to a closed port occupying the range, a new `host-for-human` call succeeds on that port and reports the removal; a mapping to a listening port is left in place; a page started with `--run` still answers over its Tailscale URL after the launching shell exits, and `--stop` removes the mapping and stops the command.
