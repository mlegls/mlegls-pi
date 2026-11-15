---
stage: "ticket"
assignee: "agent"
author: "session:thr_ihbpyrp6s2"
priority: 2
---
# Concurrent reconciler launches time out on the supervisor lock

`launchNow` in `lib/reconcile/reconcile.ts` holds `supervisor.lock` for the entire `dispatch`, including worktree creation and the `prepare` callback. `ownershipLock` waits at most 10 minutes. With about eight reconcilers launching phases into one repository, a queue of launches can outlast that wait, so the waiting launch throws `Supervisor lock held by pid N` and escalates to the owner as an exception.

In concept on 2026-11-15, two launches failed within half an hour: `report-bb-pi-dead-session-after-shutdown-upstream`, with the lock held by the outdated-tabs reconciler (pid 1068432), and `review-attempts-refuse-stale-surface-versions-in-production`, with the lock held by the document-quiz reconciler (pid 1087822). Both holders were live reconcilers, not stale ones. A plain retry worked each time.

The comment in `ownership.ts` says the lock exists so that a takeover sees a launch in flight already parented. That needs only the thread-creation and parenting step under the lock, not worktree setup or `prepare`.

Fix directions: narrow the critical section to the step that assigns the owner and parent, or treat a timeout on a held, live lock as a retry the reconciler handles itself instead of an exception to the owner.

Promoted to a ticket by the 2026-11-16 efficiency audit (@thread:thr_js85m2wmby): both auditors found the two escalations (@thread:thr_ihbpyrp6s2#msg=34212, #msg=34388), each cleared by a plain retry, after pickup started 10 reconcilers between 11-14 23:09 and 23:18.

## tasks

1. In `launchNow` (`lib/reconcile/reconcile.ts`), hold `ownershipLock` only around the step that assigns owner and parent to the new thread; worktree creation, `dispatch` and `prepare` run outside it.
2. A launch that still times out behind a live holder stays a pending launch the reconciler retries itself, without an exception to the owner. A dead holder keeps today's handling.
3. Done when: a test starting ~10 launches into one repository concurrently, with a slow `prepare`, yields every launch and no owner exception; the takeover-sees-parented-launch property the `ownership.ts` comment names still holds.
