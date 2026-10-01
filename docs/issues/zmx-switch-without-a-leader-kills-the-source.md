---
stage: idea
assignee: agent
author: session:01a0f7df-1138-76f0-8476-747adc5e73d9
---

Owner: neurosnap/zmx 0.8.1. During [[projects/mlegls-pi/stories/work-in-threads]], the private-pty driver attached to a thread while a native viewer was closing. The last leader disconnected while a non-leading client remained. `ZMX_SESSION=<source> zmx attach <target>` then deleted the source socket and stopped its agent, although the source thread remained registered.

`src/loop.zig` clears `leader_client_fd` when that client disconnects, without promoting another client. `handleSwitch` returns `NoLeaderFound`; the daemon loop propagates it and its deferred shutdown kills the source. `zmx print-env <source>` returns empty when no leader exists. The sidebar now checks that before switching, and tracks its window token to refuse switches that would move another window's leader. Workaround: reattach the main client (or type in it to establish leadership) before switching. This preflight is not atomic with a concurrent client disconnect.

[First-use evidence](../attachments/tree-sidebar-over-threads/index.md). An upstream switch error should not terminate the source daemon; reliable per-client switching belongs to zmx, not a second transport in the sidebar.
