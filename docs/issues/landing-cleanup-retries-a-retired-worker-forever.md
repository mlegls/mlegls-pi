---
stage: "ticket"
assignee: "agent"
priority: 2
author: "session:01a1742b-6754-75c7-be9d-f5c1ba794776"
claimed-by: "session:01a1742b-6754-75c7-be9d-f5c1ba794776"
---
A landing whose worker is already gone keeps its reconciler alive forever. Found supervising Concept (~/dev/mmon/concept) on 2026-10-25 (owner @thread:thr_a35xhciju2).

Five Concept roots kept running after their tickets closed on main, each logging `landing cleanup <slug> deferred: Error: No live worker <root>/<root>-review-N` 600–1900 times (`~/dev/mmon/concept/.git/reconcile/<root>.log`): scripted-review-close-interpretation-exceeds-node-bound, state-edge-direction-in-the-graph-draft-edge-schema, restore-diagnosed-retry-checkpoints-from-failed-lesson-records, graph-change-preview-edge-captions-strike-through-node-labels, replay-recovered-tool-errors-from-recordings. The runs stayed "running" with no workers, and each restart sent the owner a "started (budget 6)" notice from every one. Stopped by hand with reconcile_stop on 2026-10-26 01:44 CST; their state files are still under `.git/reconcile/`.

In `cleanupLandings` ([reconcile.ts](../../lib/reconcile/reconcile.ts)), `retire(worker, …)` throws for a worker with no live thread, the `catch` turns that into a note, `finishLandingCleanup` never runs, and the next tick retries the same worker. Two more defects in that loop:

- **Which workers it records.** The landing operation's `workers` held a retired earlier reviewer (an integration attempt's write-ahead receipt, carried into the later landing by [completion.ts](../../lib/reconcile/completion.ts) `landReviewed`), listed before the final one, so the loop never reached the final reviewer. When `recoverLandings` records the landing from an earlier attempt's receipt, the tick deletes the chain without retiring its current worker at all: state-edge-direction's op names review-3/review-4 while review-5 was its last reviewer.
- **It discards ignored state.** It calls `retire` with `discardIgnored: true`, unlike every other retirement, which moves ignored state setup can't regenerate (`.env`, `packages/web/.convex/`, `.wm/`, captures) to `<repo>__retired/` with a RETIRED.md and honours `wm.disposable`. Fixing the throw as it stood would have started deleting that state silently.

## acceptance

- A landing cleanup whose worker is already retired or missing counts that worker as done, and the cleanup finishes; the run reaches `finished` instead of retrying.
- The cleanup retires the workers that actually exist for the node, including its final reviewer, not a stale list.
- Landing cleanup keeps ignored state as every other retirement does (`__retired` + RETIRED.md, `wm.disposable`); it never discards it.
- A deferred cleanup that keeps failing is reported to the owner once, as an exception, not as an endless note and repeated "started" notices.
- Find and record what restarted every running reconciler at once several times on 2026-10-25, when no commit to this repository explains it.
- Tests cover a missing worker, a stale worker list, and ignored state being kept.

## what restarted them

Not code reloads. Every burst of "started (budget 6)" notices (2026-10-25 07:25, 13:24, 13:27, 14:12, 19:28, 19:42, 19:53, 20:00 and 2026-10-26 01:29 CST) came within seconds of a `thread/identity` event on the owner's thread, meaning a new pi had started there. The `session_start` handler in [supervision/index.ts](../../extensions/supervision/index.ts) then resumed every unfinished reconciler the owner had that wasn't running, without `quiet`, and each one mailed "started".

They weren't running because they had died. bb runs an environment's pis under one provider process, spawned in its own process group, and stops it with `kill(-pgid)`. That happens when bb reaps idle sessions ("Reaped idle provider sessions" in `~/.bb-machines/mlegls.getbb.app/logs/host-daemon.*.log`). A host-daemon restart kills them too: systemd uses `KillMode=control-group`, and the journal shows restarts at 13:24, 13:57 and 14:08 CST. Reconcilers and the pickup watcher were spawned without `detached`, so they were in that group and died with it. I watched it happen on 2026-10-26: bb reaped the owner's session at 02:33:08 CST, and provider process 2640606, its pi 2709620, the let-tags-add-skills-and-tools reconciler 2710097 and the pickup watcher 2710138 all exited together.
