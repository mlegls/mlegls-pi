---
stage: "idea"
assignee: "agent"
author: "session:thr_8mx3mvqvvh"
---
While driving the tracker pane for [[projects/mlegls-pi/issues/remote-bb-pane-drive-needs-authenticated-browser]], `bb browser-automation open --backend desktop --machine host_w74xscm3fz --desktop <instance>` exceeded CLI waits of 120s and 180s. Logs remained downloading dev-browser-darwin-arm64 at 0% for several minutes, later 10%. `list` reported ready before runtime setup completed; `run` then returned Session stopped, expired, or worker restarted. Closed the first session and retried once. Owner: BB bundled browser-automation plugin. Workaround under investigation: core bb browser lease with host-local CDP. Origin @thread:thr_8mx3mvqvvh; evidence in [desktop first use](../attachments/bb-tracker-follows-every-link-in-an-issue/desktop-first-use.md).
