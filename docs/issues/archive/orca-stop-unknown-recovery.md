---
stage: done
priority: 2
---

Original receipts confirmed the ownership boundary: worker-stop returned stop_unknown with processAction:none because the terminal was external. Release then misleadingly recommended stop; a recorded repeated stop refused dispatch_inactive. The native state transition is not repaired in this repository.

Resolved locally 2026-09-21: worker-stop/release refusals with dispatch_inactive and stop_unknown now add explicit inspection/settlement guidance while retaining the native error receipt unchanged. No automatic abandonment, process kill, or retry. [Recovery procedure](../../orca.md#stop_unknown-recovery). Replayed the original stop and release error envelopes through the CLI adapter; both gained guidance and preserved their envelopes. No active worker was mutated.

Evidence: original session cited in the [triage](../../research/session-friction-triage-2026-09-21.md), physical lines 415, 797, 800. Native launch ownership remains [[projects/mlegls-pi/issues/orca-pi-launch-ownership]].
