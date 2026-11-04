---
stage: "ticket"
assignee: "agent"
priority: 2
author: "session:thr_pqt8kgvd8h"
---
A supervisor takeover leaves execution attached to the old supervisor, and the steps that move it are done by hand and go wrong.

Evidence (efficiency audit 2026-11-05, @thread:thr_pqt8kgvd8h):
- 11-04: after a 403 `verification_required` stopped @thread:thr_a35xhciju2, the user asked @thread:thr_ihbpyrp6s2#msg=1 to take over as main supervisor. Archiving the old thread also archived 9 of its workers, 7 of them waiting on the user's answers; they were unarchived and reparented by hand (@thread:thr_ihbpyrp6s2#msg=611). Workers it spawned showed as siblings until the user noticed (#msg=431).
- The pickup watcher and 8 reconcilers kept the archived thread as owner, so the next launch (`draw-the-mission-run-past-now-and-future`) failed; found about 2h later and fixed by stopping and restarting each process from the new thread (#msg=798).
- 11-02: the same slip in reverse: reconcilers restarted from the efficiency-audit thread inherited its identity, and a review worker reported there instead of to the supervisor (@thread:thr_ae8q9yrxnv).

Ticket: one idempotent operation, e.g. `ab desk handover <old> <new>` (or a `reconcile` adopt), that
1. moves the ROLES entry, the old owner's `desk/ATTENTION.md` items and the pickup owner to the new thread;
2. re-points every running reconciler and the watcher (owner and notification target) without stopping workers or withdrawing pending exceptions;
3. reparents the old thread's live children to the new one;
4. checks the new owner can launch a worker, then archives the old thread without cascading to its children;
5. prints what it moved.

Acceptance: on a scratch supervisor with one reconciler holding a needs-input exception and one live worker, handover leaves the worker unarchived and parented to the new thread, `reconcile_status` shows the new owner, the exception is still pending and resolvable from the new thread, a later dispatch succeeds, and the old thread is archived.
