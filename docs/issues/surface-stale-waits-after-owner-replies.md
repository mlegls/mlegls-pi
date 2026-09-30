---
stage: ticket
assignee: agent
author: session:01a0e5e9-67b7-732e-90ce-7e6ac7a4ad76
---

Owner: `ab supervise status` and the loop's wake logic. A job parked on an exception shows `waiting: <reason>` with no age. If the owner answers but the steer never reaches the child (see [[address-the-waiting-child-in-exception-mail]]), nothing happens after that. No turn arrives and no event fires, so the owner's compacted memory carries the job forward as "awaiting its report". In Concept this left count-getting-started waiting for 6 h and server-render for 20 h.

Fix: show `waiting: <reason> since <time>` in status. Re-wake the owner when an exception has had owner mail, but no child turn, for N minutes.

triage, 2026-09-30: N is 30 minutes, re-woken once per exception (not repeatedly).

review boundary, 2026-09-30: the supervise-loop group (bounce-handoff-shape-errors-to-the-child, address-the-waiting-child-in-exception-mail, supervise-job-dies-on-a-decision-api-503-at-child-launch, surface-stale-waits-after-owner-replies, turn-end-sentinel-parser-rejects-preambles) is reviewed once as a combined delta from `894e8c6` by the root tend session after all five integrate, before the next `ab daemon shutdown` loads them. This is a code review of the combined diff; each leaf's own acceptance review (evidence packet against the ticket) still runs.
Result (first-use drive): [evidence packet](../attachments/surface-stale-waits-after-owner-replies/index.md). The handed-off checkout had no supervision jobs; both wait-specific behaviors remained unobservable through its CLI entry point.

