---
stage: done
assignee: agent
author: session:01a0f69a-dbcb-7684-87de-422739d2c54e
part-of: "[[projects/mlegls-pi/issues/thread-registry-on-zmx]]"
priority: 3
---

Every active thread keeps its pi running inside zmx ([[projects/mlegls-pi/issues/thread-registry-on-zmx]]). Measure what that costs, to decide whether the registry should reap idle threads nobody is viewing and resume them on view.

- idle RSS and CPU of one pi (with this machine's extensions) inside zmx, after a short session and after a long one; extrapolate to ~30 threads.
- latency from `zmx attach <name> pi --session <file>` to a usable TUI for a small and a large session file.

result: the numbers, and a recommended policy (never reap / reap after N minutes idle and unviewed).

## Result

30 idle threads cost about **11.5–12.3 GiB of physical footprint**, including their MCP subprocesses, on this 24-GiB Mac. Pi alone: **118 / 155 MiB median RSS**, **0.50 / 0.71% of one core** after the short / long restored session plus one real model turn. Fresh text-session resume → responsive editor: **1.46 / 1.76 seconds median**; a 53.5-MiB image-heavy file with image display disabled took **5.32 seconds**.

Recommend **15 minutes idle and unviewed before reaping quiescent threads**. Keep waiting parents/workers resident until something outside pi owns wake-on-mail: [[projects/mlegls-pi/issues/idle-thread-reaping-needs-external-board-wakes]]. Do not enable blanket reap-on-view in the current cutover. The surprisingly large per-pi MCP share is [[projects/mlegls-pi/issues/per-thread-idle-mcp-client-cost]]. No runtime policy was changed.

## Evidence

**Before:** no measured budget or restart latency.
**After:** [numbers, method, raw process samples and reproduction entrypoint](../attachments/measure-idle-pi-cost/index.md). All measured TUIs and subprocess trees stopped. Existing regressions: 167 passed, 2 skipped; typecheck passed after the [[projects/mlegls-pi/issues/root-setup-still-omits-obsidian-typecheck-dependencies|existing nested-package setup workaround]]. Restored-history measurements are not an uninterrupted 14-hour process high-water test; text-terminal timings do not claim Ghostty image-render latency.

Independent [CLI drive and replayable checks](../attachments/measure-idle-pi-cost/drive.md): required measurement/policy stories held; exact replay numbers and evidence limits recorded separately.

## Danger

**Door:** two-way; documentation and a disposable measurement script only.
**Blast radius:** none; source session files and the running-thread policy are unchanged.
