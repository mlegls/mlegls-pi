---
stage: ticket
assignee: agent
priority: 4
author: session:01a0f324-32e8-732c-96ad-132d2d15485e
---

`/private/tmp/tmux-501/` held about 900 sockets on 2026-10-01, mostly `pi-terminal-test-*` and `pi-terminal-*`, dated 2026-09-23 to 2026-09-30. Only four tmux servers were alive, so these are sockets of servers that ended without being cleaned up. Fix: tests that start a tmux server with `-L` kill it and remove the socket in teardown, and sweep stale ones of their own prefix at start.
