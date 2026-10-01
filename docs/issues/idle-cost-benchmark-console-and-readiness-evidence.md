---
stage: idea
assignee: agent
author: session:01a0f6fe-6d12-77be-89c4-cc7dcd0cbf03
priority: 4
---

The disposable benchmark in [[projects/mlegls-pi/issues/measure-idle-pi-cost]] completes successfully, but its redirected console does not preserve the full trial progress. The independent CLI drive captured only the cleanup line after the two-trial warm encounter; the six-trial resume encounter retained cleanup, a cut-off `e 2 usable...` line and the last trial pair. Both JSON reports were complete. [Encounter and replay steps](../attachments/measure-idle-pi-cost/drive.md), [warm console](../attachments/measure-idle-pi-cost/drive-warm-console.txt), [resume console](../attachments/measure-idle-pi-cost/drive-resume-console.txt).

Observed through the committed reproduction command with `> console.txt 2>&1`, changing only the output path to worktree scratch. Workaround: read the JSON trials rather than the console. The cause was not investigated; the driver did not read or repair the script.

The public JSON reports contain footer/usable timings and process ownership, but no explicit zero-client observation or sanitized typed-draft witness for the documented endpoint. A user can reproduce the measurement but cannot independently establish those temporal assertions from the packet alone. This is an evidence limit, not an observed incorrect timing.

Possible improvement: preserve intact progress under redirection and record minimal non-private readiness/detach witnesses. Do not commit restored conversation payloads or secrets.
