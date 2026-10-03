---
stage: idea
author: "session:ccea9429-e217-4757-b9bc-ea647fbf07f0"
---

During SCM `settle-through-arkhai-payments` real-ledger setup, managed `podman machine start` reported exit 0 after 25 seconds. The next `podman ps` and managed `bun run ledger:local` failed to connect to `127.0.0.1:62901` (connection refused). Machine list showed no running machine. Repeating startup inside one managed command that continued into ledger setup and the long-lived payments HTTP service worked; its containers and `/health` became reachable.

Owner: pi process child lifecycle, or Podman machine startup; cause is not established. Workaround: keep machine startup and its consumer in the same live managed command. Check whether process-group cleanup on successful parent exit kills the launched hypervisor, and distinguish this from a Podman startup defect.
