---
stage: "ticket"
assignee: "agent:technical"
author: "session:01a20621-fdb8-74d3-8ab0-6ecb91858267"
part-of: "[[projects/mlegls-pi/issues/promised-wake-turns-end-with-nothing-to-wake-them]]"
claimed-by: "reconcile:promised-wake-turns-end-with-nothing-to-wake-them/promised-wake-turns-end-with-nothing-to-wake-them-refine-2"
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