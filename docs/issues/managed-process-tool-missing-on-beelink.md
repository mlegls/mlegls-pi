---
stage: "idea"
assignee: "agent"
priority: 2
author: "session:01a17551-2211-720c-a808-6ff59567ffd7"
---
On host `beelink` (2026-10-26), pi sessions have no `process` tool. The shared `~/.pi/agent/settings.json` (from `~/.config/system-config`) lists the package `../../dev/pi-processes`, but `~/dev/pi-processes` doesn't exist there, so the package doesn't load. Observed in the triage worker session `01a17551-2211-720c-a808-6ff59567ffd7` (bb thread thr_ueame4a4gi): its tool list (`ALL_TOOLS`) has bash, read, edit and the rest, but no `process`. Meanwhile the [guard extension](../../extensions/guard/index.ts) and the worker bootstrap prompt tell workers to run slow hooks and long commands "as a managed process" and to stop processes "with the process tool".

Impact seen in Concept: [[projects/concept/issues/material-comparison-capture-killed-by-command-timeout]]. A worker ran a paid DeepSeek Lesson capture in bash, and the 200-second timeout killed it mid-stream, leaving a cancelled charge and a locked spending ledger. A later session interruption killed a plain-backgrounded GLM capture the same way. The workaround was `setsid` with detached stdio and pid/log files, polled by hand. Whether that worker ran on beelink is not recorded; the missing tool here is established.

Observation: the package path is relative to the home directory and absent on this host. Proposed: install or clone pi-processes (the fork with the 2026-10-02 process-group fix, see [[projects/mlegls-pi/issues/managed-process-completion-notice-did-not-reach-a-waiting-worker]]) at `~/dev/pi-processes` on every host that runs workers, or make the bootstrap warn when the package path in settings is missing.
