---
next: research
priority: 2
---

September 21 coordinator reports worker-stop leaving stop_unknown, then worker-release refusing with “only a settled worker can release… use worker-stop.” worker-abandon was the escape. [Original report locator](../research/session-friction-triage-2026-09-21.md).

The existing live audit verified operator-close followed by an already-settled stop, not this failure. Recover the original Dispatch receipts/version and determine whether stop_unknown is intentional uncertainty with inadequate guidance or a native lifecycle defect. Any fresh reproduction must use a disposable worker, not an active assignment.

Done: an evidence-backed recovery sequence that does not fabricate success or resend accepted work; upstream report if native state transitions are inconsistent. External terminal processAction:none is separately expected and tracked by [[projects/mlegls-pi/issues/orca-pi-launch-ownership]].
