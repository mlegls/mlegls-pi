---
stage: "idea"
priority: 3
author: "session:01a19a74-4995-71d6-a961-c51d59747b8e"
---
While reviewing [[projects/mlegls-pi/issues/serve-review-pages-over-tailscale-https-from-a-supervised-process]] on Beelink (2026-11-02), `tailscale serve status` showed HTTPS ports 10000, 10001 and 10003 held by non-host-for-human mappings (launch-video bridge, convex proxy, takes) and 10002 free. The earlier [[projects/mlegls-pi/issues/tailscale-review-https-range-is-full]] was the same shape: all four ports occupied, one by a mapping whose upstream (127.0.0.1:18174) refused connections, released by hand.

Observation: `bin/host-for-human` allocates only from 10000–10003, never touches mappings it did not create, and keeps a reservation in `~/.local/state/host-for-human/*.json` until `--stop`. Any one abandoned review page (no `--stop`) or dead foreign mapping permanently costs a port, and with three foreign mappings live a second concurrent review fails with "no free Tailscale HTTPS port in 10000–10003".

Decision it waits on: reclaim policy. Options: (a) reclaim host-for-human reservations whose directory is gone or whose service has been inactive past some age; (b) reclaim foreign mappings whose upstream refuses connections; (c) widen the mapped range; (d) move the launch-video mappings elsewhere. (b) removes other tools' state and needs the maintainer's call.
