---
stage: "ticket"
assignee: "agent"
priority: 2
author: "session:thr_vrgtjptnu2"
---
# A turn that promises to act on an event ends with nothing to wake it

Three threads ended on a promise to act when something finished, and the maintainer came back 15–21 hours later to ask for status: AP "I've set a watcher on the run… I'll do one publish run" at 11-21 17:10, asked 15h later (@thread:thr_5az79m87jp#msg=12101); AP "A watcher is running on the refresh… When the refresh finishes, I'll republish", 20h later (@thread:thr_5az79m87jp#msg=4268); investing "`staging-deploy-watch-2` wakes me when it ends", 21h later (@thread:thr_nu4vhuek7p#msg=2563). Some watchers may have died in the 2026-11-21 bb daemon OOM restarts. Found by the 2026-11-23 efficiency audit (@thread:thr_vrgtjptnu2, Opus auditor @thread:thr_ujfhuerecr); the maintainer asked for this ticket.

## tasks

1. At turn end in `extensions/guard/index.ts`: when the final text promises action on an event (e.g. `/\b(when|once)\b.{0,80}\b(finish|end|land|pass|complete)s?\b.{0,40}\bI'll\b|wakes me/i`) and the session has no live managed process, refuse the turn once with "Nothing is running that will wake this thread. Wait in the foreground with process wait, or hand the wait to an automation."
2. Find why a live watcher's completion didn't wake these threads: process tool state lost on pi restart or idle reap ([[projects/mlegls-pi/issues/idle-thread-reaping-needs-external-board-wakes]], [[projects/mlegls-pi/issues/waiting-worker-loses-managed-process-registry-and-provider]]). Fix it, or have a restart re-announce each lost process to its thread so the thread resumes.
3. Done when: a test ends a turn on such a promise with no process and gets the refusal; one with a live process passes; a process lost across a pi restart produces a notice in its thread.
