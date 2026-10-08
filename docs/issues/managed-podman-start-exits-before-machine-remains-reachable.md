---
stage: idea
author: "session:ccea9429-e217-4757-b9bc-ea647fbf07f0"
---

During SCM `settle-through-arkhai-payments` real-ledger setup, managed `podman machine start` reported exit 0 after 25 seconds. The next `podman ps` and managed `bun run ledger:local` failed to connect to `127.0.0.1:62901` (connection refused). Machine list showed no running machine. Repeating startup inside one managed command that continued into ledger setup and the long-lived payments HTTP service worked; its containers and `/health` became reachable.

Owner: pi process child lifecycle, or Podman machine startup; cause is not established. Workaround: keep machine startup and its consumer in the same live managed command. Check whether process-group cleanup on successful parent exit kills the launched hypervisor, and distinguish this from a Podman startup defect.

Likely cause, 2026-10-08: the process tool is the local fork `~/dev/pi-processes` (pi settings source). Its `65ac227` (2026-10-02 15:26 UTC, a day before this encounter) stops descendants still in a finished command's process group 10s after the leader exits (`stopLeftovers` in `src/manager.ts`). It exists because a process is only finalized once its whole group is gone (`finalizeIfGroupEnded`), so a daemon left in the group kept the record live forever. Podman's VM processes would be such descendants. Repro: managed `podman machine start`, then look for `[pi-processes] the command exited, but these processes still held its process group and were stopped` in its stderr.

holes:
- what a finished command's leftovers get. Proposed: terminal semantics. Finalize on leader exit (after the pipes close, or a short grace if a descendant holds them, then stop reading), name the survivors in the completion notice, and leave them running; they're still the agent's to stop. Killing them is what `podman machine start`, `docker compose up -d` or any daemonizing starter can't survive, and an opt-out flag would need every caller to know it in advance.
