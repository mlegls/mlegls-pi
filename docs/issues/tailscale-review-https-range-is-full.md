---
stage: "done"
assignee: "human"
priority: 2
author: "session:thr_u78n63dexw"
---
idea: While preparing the first-use fixture for [[projects/mlegls-pi/issues/serve-review-pages-over-tailscale-https-from-a-supervised-process]], @thread:thr_u78n63dexw found all four mapped HTTPS ports occupied on Beelink (2026-11-02). `tailscale serve status --json` maps 10000→4410, 10001→3219, 10002→18174, 10003→4720. Ownership and ongoing review needs are unknown. Running `bin/host-for-human skills/enabled/all/mlegls/artboard --name review-page-first-use` refuses with `no free Tailscale HTTPS port in 10000–10003; existing mappings were left untouched` before starting a server. No existing mapping was removed. No workaround applied: a port owner must release a mapping, or the maintainer must authorize expanding the mapped range. This blocks first-use validation on the specified range; it is not evidence that the existing pages are dead.

## Result

10002 mapped to 127.0.0.1:18174, where nothing listened (connection refused); released it with tailscale serve --https=10002 off on 2026-11-02. The other three serve live processes in concept__worktrees/launch-video (bridge 4410, convex site proxy 3219, takes 4720) and were left alone. A recurrence wants host-for-human to reclaim mappings whose upstream is dead.
