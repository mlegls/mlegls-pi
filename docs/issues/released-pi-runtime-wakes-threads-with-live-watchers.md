---
stage: "done"
assignee: "agent:technical"
author: "session:01a20621-fdb8-74d3-8ab0-6ecb91858267"
part-of: "[[projects/mlegls-pi/issues/promised-wake-turns-end-with-nothing-to-wake-them]]"
priority: 2
---
When BB releases an idle Pi runtime while a managed process (pi-processes) is still live, the thread that started it gets a new turn without user input: either the process's completion wakes it, or the process's loss is announced to it. Part of [[projects/mlegls-pi/issues/promised-wake-turns-end-with-nothing-to-wake-them]], which quotes the three threads that waited 15–21 hours for a wake that never came.

What the first implementer found (parent's respec): all three watchers were live when their threads yielded. Pi stopped each one during shutdown 31m10s, 31m41s and 23m49s after the turn ended (the last trigger unconfirmed), and BB received no wake. BB releases a runtime after 30 idle minutes (`bb guide thread-lifecycle`, under `thread stop`) and its plugin SDK exposes no runtime-release event. A `session_start` notice alone doesn't help: nothing restarts the released Pi.

Context that is already in place:
- pi-processes (`~/dev/pi-processes`, ad8a5e3 from [[projects/mlegls-pi/issues/waiting-worker-loses-managed-process-registry-and-provider]]) writes a `registry.json` beside the session file and reports a process killed at shutdown as interrupted with its retained logs after a restart; cleanup is `src/hooks/cleanup.ts`. Receipts for the three watchers read `killed` on Pi shutdown (project note, 2026-11-23 audit).
- A queued `bb thread tell <id>` (or `--self` with the inherited `BB_THREAD_ID`) starts a turn on an idle thread, released runtime or not; that is how BB replaced board wakes ([[projects/mlegls-pi/issues/idle-thread-reaping-needs-external-board-wakes]]).
- BB's `resumeThreadsAfterRestart` already resumes idle threads whose background work a daemon restart stopped, and the provider bridge has `item/backgroundTask/*` events that outlive their turn; whether BB's Pi provider can carry managed processes as background tasks is BB's to own (upstream), worth knowing before building beside it.
- `bb thread stop` on an idle thread is documented as the same release, with no interruption; a stop that interrupts a running turn is the user stopping work. Which of these should still wake the thread is for this ticket to settle from what Pi can observe; the user stopping a turn should not queue a wake.

How (a detached waiter that outlives Pi and tells the thread, a BB-side service over the receipts, or upstream background tasks) is yours.

Done when: with a watcher live, the thread's runtime is released (idle release or its equivalent) and a new turn starts in that thread without user input, carrying the process's outcome or its loss; a user Stop of a running turn produces no such turn. Use a real BB thread for the acceptance run.

## Result

done. Both stories held in the driver's real BB runs, and they still hold on `005d0cca`. I fixed one problem where this change meets worker retirement.

**The problem:** when an owner retires a worker (`lib/thread/lifecycle-cleanup.ts`), it marks the worker's Pi as retired and then sends BB's idle `thread stop`. The new hook treated that Stop as an idle release. So a worker retired with a dev server still running would get a wake turn before `archiveBb` ran, in a worktree that was being deleted.

**The fix (`3fdd58af`):** the hook now skips shutdowns that carry the retirement mark. That check is `isRetired` in `lib/session-meta/live.ts`. It only reads the mark, so the parent's child-exit monitor still gets to consume it. Tested offline with a sandboxed fake setup. Before the fix, both a normal and a retirement-marked idle shutdown started the wake helper; after it, only the normal one does. I didn't re-run this on a real BB thread.

**Tests:** the session-meta, reconciler-notices, bb-pi, runtime and lifecycle tests passed, and so did `typecheck`. This project has no `test:affected` task.

**The driver's two frictions:**
- The setup command returning before the watcher is ready only affects the driver's test script, and the packet's procedure covers it.
- BB labelling the automatic notice as `initiator: user` is how BB treats `tell`; the notice text says why the thread woke.

I filed neither.

```yaml
commit: 005d0cca
stories:
  - story: Releasing an idle runtime with a live watcher wakes the same thread with the watcher's outcome or loss.
    outcome: held
  - story: Stopping a running turn with a live watcher does not trigger a follow-up.
    outcome: held
evidence:
  path: docs/attachments/released-pi-runtime-wakes-threads-with-live-watchers/index.md
  visual: false
  shots: []
tests: []
filed: []
fixed:
  - "3fdd58af: retiring a worker (stopBb before archiveBb in lib/thread/lifecycle-cleanup.ts) with live managed processes no longer queues a wake turn into the retiring thread"
caveats:
  - "Every idle release with a managed process still live (e.g. a dev server left running on purpose) now costs one model turn on the woken thread, plus a detached bun helper that waits up to 15 s for the old Pi to exit before telling."
  - "The release outcome is always the loss notice: pi-processes kills watchers at shutdown, so a watcher's real completion is never reported after a release."
  - "The idle-release story used BB's documented idle `thread stop` equivalent, not the 30-minute timer."
  - "The retirement fix was checked offline only; it was not re-run against a real BB thread."
```

Evidence: [docs/attachments/released-pi-runtime-wakes-threads-with-live-watchers/index.md](../attachments/released-pi-runtime-wakes-threads-with-live-watchers/index.md)
