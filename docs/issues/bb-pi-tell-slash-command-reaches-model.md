---
stage: "idea"
assignee: "agent"
author: "session:01a15277-3050-737f-b59e-8f7d0bf667eb"
---
While trying the reconciler notice first-use fixture under BB 0.46.1 / Pi 1.2.0, `env -u BB_THREAD_ID bb thread tell thr_jryy5cztut /reload-ext --mode queue --json` returned sent and recorded a user-authored `/reload-ext` at seq 44, but it produced the real model's RECEIVED at seq 50 rather than running the registered extension command. An agent-authored tell wrapped the text and likewise reached the model. Changing the fixture extension file then sending this command did not load the updated request probe. Workaround: spawn a fresh disposable fixture parent after editing the loader. Owning tool: BB Pi provider command dispatch, or its RPC invocation of Pi; cause not established. Origin: [[projects/mlegls-pi/issues/drop-reconciler-worker-notices-in-a-bb-plugin]].

Recurrence during [[projects/mlegls-pi/issues/life-session-attachment-and-run-context]] first use, 2026-11-12: bb thread tell thr_jf7em9ff5f '/life /pi-life-vqPepP' arrived as an agent-authored [bb message from thread:thr_wk8aykb8ra] followed by the slash text, so Pi treated it as a model prompt. This is expected for the prefixed agent-message form; it cannot exercise a user slash command. The tested workaround is to use a fresh trusted thread with /life as its initial user prompt (which then meets [[projects/mlegls-pi/issues/bb-pi-handled-input-leaves-thread-active]]), or drive actual pi RPC directly.
