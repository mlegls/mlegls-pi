---
stage: idea
assignee: agent
author: session:86d24b04-f507-431f-be52-5c33b3e2f361
---

During [[projects/concept/issues/gate-supervised-integration-on-the-kept-browser-batch]], started managed `proc_2` (`mise run pre-integrate`) at 2026-10-02 04:06 UTC in the same worker session. It remained idle awaiting the process tool's automatic completion notification. The root supervisor later observed that the process had completed at 04:12 UTC, but the waiting worker had not received its completion notice. Root mailed the retained combined-log path at 04:55 UTC; the worker then consumed its actual failed-task receipt, restored the diagnostic assertion and continued. The automatic `proc_2` exit-1 notice eventually arrived after the green gate had finished and the next process had started, reporting a 56m56s duration. This establishes a delayed wake, not permanent notification loss; the discrepancy with root's 04:12 terminal observation is unresolved. [[projects/concept/attachments/gate-supervised-integration-on-the-kept-browser-batch/index|Evidence packet]].

No process restart, duplicate trial, lost test outcome or new worktree/session occurred in this encounter. `process output proc_2` could still recover the retained output after root's notice. The worker had ended with `blocked` pending-process reports under the old sentinel contract; root then introduced `waiting` and the worker replied `waiting (proc_2)`. Whether notification delivery, report suspension or exception handling caused the missing wake is not established.

Owner: mlegls-pi process notifications and reconciler waiting/report handling. Workaround was the root's one-off terminal-result notice with the existing log, not polling or a second process. Related inherited-session ownership observation: [[projects/mlegls-pi/issues/checkpoint-continuation-cannot-observe-inherited-managed-processes]]; this encounter retained the original session, so it does not establish that same cause.

## Cause (2026-10-02 11:20 UTC)

Not a dropped or unqueued notice. `@mjakl/pi-processes` (2.0.0 installed; 2.5.0 is the same) ends a managed process only when the leader has closed **and** its whole process group is gone (`manager.ts` `finalizeIfGroupEnded` / `livenessTick`). Concept's gate (`sh -c bun run check && bun test && bun run test:browser:chromium`) leaves Convex local-backend node executors (`node $TMPDIR/.tmpXXXX/local.cjs --ipc-path …/.executor.sock`) orphaned to ppid 1 but still in the gate's process group. While one lives, the process stays `running` and no completion notice is ever sent. At 11:16 UTC eight such executors were alive in five groups, the oldest from 2026-10-01; group 21569 (started 04:09 UTC) matches gate implement-1 `proc_2`. `proc_2`'s late notice (56m56s) fits the manager's PID-reuse guard: once another process takes the leader's numeric PID, it treats the group as released and finalizes.

Fixes: the gate (concept) should stop its executors; upstream, pi-processes could notify when the leader exits while descendants still hold the group, naming them. Backstop in the reconciler: a chain waiting 30m with no report is nudged to check its process, kill it if its output shows the command finished, and continue.

## Fix (2026-10-02)

pi-processes now stops what still holds a command's group 10 s after the command exits, names those processes in stderr, and keeps the command's own exit code: mlegls/pi-processes `stop-leftover-group-members` (65ac227), loaded locally from ~/dev/pi-processes through system-config's pi settings, upstream as https://github.com/mjakl/pi-processes/pull/7. Concept's own leak is [[projects/concept/issues/local-convex-backends-leak-executors-and-temp-bundles]].

Upstream: https://github.com/mjakl/pi-processes/issues/8 (notify when the leader exits, naming the descendants still holding the group).

## Recurrence — arkhai-payments 2026-10-07

`card-top-up-reversals-drive-f` reported `waiting reversal-drive-retry` at 07:22 UTC; by 07:25 no drive process existed and the containers for its chosen ports had never been created (podman healthy). The worker stayed idle until the owner mailed it to inspect the process output and rerun. The reconciler showed the chain in `drive` with `waitingSince` set and no live worker process. A reconciler-side check, a waiting chain whose named process no longer exists, would have caught it without the owner.

Reconciler check (3f23216): a chain still `waiting` 2 minutes after its report, whose worker is idle and whose pi has no managed process (a process-group leader under pi with stdin on /dev/null, which tells it from pi's MCP servers), is told its process has ended or never started, once per `waiting` report. The 30-minute nudge stays for processes that are still running. Untried against a live worker: the detection was checked by hand against this session's own pi with and without a managed process.
