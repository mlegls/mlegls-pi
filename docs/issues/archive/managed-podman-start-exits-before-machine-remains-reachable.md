---
stage: done
assignee: agent
author: "session:ccea9429-e217-4757-b9bc-ea647fbf07f0"
---

Done: in `~/dev/pi-processes` (fork `mlegls/pi-processes`), a managed command is finalized when its leader exits, and processes left in its group keep running and are named in the completion notice. First confirm the cause with the repro below. A test there starts a command that leaves a daemon in its group and shows the record finishes, the daemon survives, and the notice names it. Then a managed `podman machine start` leaves the machine reachable. `65ac227` is upstream PR mjakl/pi-processes#7 (open, unreviewed); the fix lands there as a revision of that PR, on branch `stop-leftover-group-members`, so upstream never gets the kill behaviour.

During SCM `settle-through-arkhai-payments` real-ledger setup, managed `podman machine start` reported exit 0 after 25 seconds. The next `podman ps` and managed `bun run ledger:local` failed to connect to `127.0.0.1:62901` (connection refused). Machine list showed no running machine. Repeating startup inside one managed command that continued into ledger setup and the long-lived payments HTTP service worked; its containers and `/health` became reachable.

Owner: pi process child lifecycle, or Podman machine startup; cause is not established. Workaround: keep machine startup and its consumer in the same live managed command. Check whether process-group cleanup on successful parent exit kills the launched hypervisor, and distinguish this from a Podman startup defect.

Likely cause, 2026-10-08: the process tool is the local fork `~/dev/pi-processes` (pi settings source). Its `65ac227` (2026-10-02 15:26 UTC, a day before this encounter) stops descendants still in a finished command's process group 10s after the leader exits (`stopLeftovers` in `src/manager.ts`). It exists because a process is only finalized once its whole group is gone (`finalizeIfGroupEnded`), so a daemon left in the group kept the record live forever. Podman's VM processes would be such descendants. Repro: managed `podman machine start`, then look for `[pi-processes] the command exited, but these processes still held its process group and were stopped` in its stderr.

decisions:
- 2026-10-08 what a finished command's leftovers get: terminal semantics.

result: confirmed and fixed in `~/dev/pi-processes` `9f69ea7`, which replaces `65ac227` on mjakl/pi-processes#7 (force-pushed; title and body updated). Repro on the old code, 2026-10-08: managed `podman machine start` reported success after 20s, and afterwards `podman machine list` showed the machine not running. The `stopLeftovers` note never reached stderr, and `process output` failed (see [[projects/mlegls-pi/issues/managed-process-retained-logs-disappear-during-test-run]]). On the new code the command ended with exit 0, and gvproxy and vfkit stayed in its process group with the machine reachable (`podman info`). Tests: `ends a command that leaves a daemon in its group …` in `src/manager.integration.test.ts`, holding and not holding the pipes. They fail on the old code. Running sessions keep the old code until pi reloads. Finalize on leader exit (after the pipes close, or a short grace if a descendant holds them, then stop reading), name the survivors in the completion notice, and leave them running; they're still the agent's to stop. Killing them is what `podman machine start`, `docker compose up -d` or any daemonizing starter can't survive, and an opt-out flag would need every caller to know it in advance.
