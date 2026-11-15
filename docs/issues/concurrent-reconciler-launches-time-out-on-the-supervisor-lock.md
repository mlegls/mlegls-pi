---
stage: "done"
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

## Result

done

I made no code repairs. `bun test lib/reconcile/ownership.test.ts` gives 1 pass and 62 expectations in about 16 s. `bun test lib/reconcile` (53 tests) and the dispatch, wm, handover and thread tests (36) also pass. `mise run test:affected` doesn't exist in this repo, so I ran those suites directly.

The driver marked dead-holder handling "unobservable". I checked it against the test source and it holds. The test rewrites the lock holder's pid to a dead one, and the launches go through the unchanged reclaim path in `ownershipLock`.

I appended a review section to the driver's packet and committed it as `ef6c7619`.

```yaml
commit: ef6c7619
stories:
  - story: Ten concurrent launches complete with slow preparation and no owner exception
    outcome: held
  - story: Live-holder contention remains pending and retries automatically
    outcome: held
  - story: Takeover preserves parented launches
    outcome: held
  - story: Dead-holder handling remains unchanged
    outcome: held
evidence:
  path: docs/attachments/concurrent-reconciler-launches-time-out-on-the-supervisor-lock/index.md
  visual: false
  shots: []
tests:
  - lib/reconcile/ownership.test.ts
caveats:
  - "A launch behind a permanently live lock holder retries without bound, logging once per 10-minute wait. The ticket asked for retry on a live holder, so I left it."
  - "The fixture test fakes the BB CLI. It advances the clock past the 10-minute wait, so the whole scenario runs in about 16 s. No live BB deployment was exercised."
```

Evidence: [docs/attachments/concurrent-reconciler-launches-time-out-on-the-supervisor-lock/index.md](../attachments/concurrent-reconciler-launches-time-out-on-the-supervisor-lock/index.md)
