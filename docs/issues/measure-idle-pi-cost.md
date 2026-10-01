---
stage: ticket
assignee: agent
author: session:01a0f69a-dbcb-7684-87de-422739d2c54e
part-of: "[[projects/mlegls-pi/issues/thread-registry-on-zmx]]"
priority: 3
---

Every active thread keeps its pi running inside zmx ([[projects/mlegls-pi/issues/thread-registry-on-zmx]]). Measure what that costs, to decide whether the registry should reap idle threads nobody is viewing and resume them on view.

- idle RSS and CPU of one pi (with this machine's extensions) inside zmx, after a short session and after a long one; extrapolate to ~30 threads.
- latency from `zmx attach <name> pi --session <file>` to a usable TUI for a small and a large session file.

result: the numbers, and a recommended policy (never reap / reap after N minutes idle and unviewed).
