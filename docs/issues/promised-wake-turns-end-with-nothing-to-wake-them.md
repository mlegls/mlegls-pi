---
stage: "done"
assignee: "agent"
priority: 2
author: "session:thr_vrgtjptnu2"
---
# A turn that promises to act on an event ends with nothing to wake it

Three threads ended on a promise to act when something finished, and the maintainer came back 15–21 hours later to ask for status: AP "I've set a watcher on the run… I'll do one publish run" at 11-21 17:10, asked 15h later (@thread:thr_5az79m87jp#msg=12101); AP "A watcher is running on the refresh… When the refresh finishes, I'll republish", 20h later (@thread:thr_5az79m87jp#msg=4268); investing "`staging-deploy-watch-2` wakes me when it ends", 21h later (@thread:thr_nu4vhuek7p#msg=2563). Some watchers may have died in the 2026-11-21 bb daemon OOM restarts. Found by the 2026-11-23 efficiency audit (@thread:thr_vrgtjptnu2, Opus auditor @thread:thr_ujfhuerecr); the maintainer asked for this ticket.

## shape

Two disjoint parts:
- [[projects/mlegls-pi/issues/guard-refuses-promised-wakes-with-no-live-process]]: the turn-end guard, for a promise made with nothing running.
- [[projects/mlegls-pi/issues/released-pi-runtime-wakes-threads-with-live-watchers]]: the observed failure. All three watchers were live when their threads yielded; Pi stopped them at shutdown 23–32 minutes later (BB's 30-minute idle release), and nothing outside Pi woke the threads.

Done when both hold.

## Result

done — Both driver expectations held. The guard and release hook now share one registry reader and one definition of a live process. All 11 affected tests and both offline replay modes passed before and after consolidation.

```yaml
commit: 266c75f4
stories:
  - story: A promise backed by a live watcher stands, and releasing the idle runtime wakes the same thread with the watcher's outcome.
    outcome: held
evidence:
  path: docs/attachments/promised-wake-turns-end-with-nothing-to-wake-them/index.md
  visual: false
  shots: []
changes:
  - Consolidated receipt parsing and live-status recognition in lib/thread/process.ts so the guard and release hook agree on which watchers are pending.
tests: []
filed: []
caveats:
  - The independent BB drive used idle Stop rather than waiting for the 30-minute lease expiry. The same thread replied 23 seconds after shutdown.
```

Evidence: [docs/attachments/promised-wake-turns-end-with-nothing-to-wake-them/index.md](../attachments/promised-wake-turns-end-with-nothing-to-wake-them/index.md)
