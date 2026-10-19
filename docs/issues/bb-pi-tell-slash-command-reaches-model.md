---
stage: "idea"
assignee: "agent"
author: "session:01a15277-3050-737f-b59e-8f7d0bf667eb"
---
While trying the reconciler notice first-use fixture under BB 0.46.1 / Pi 1.2.0, `env -u BB_THREAD_ID bb thread tell thr_jryy5cztut /reload-ext --mode queue --json` returned sent and recorded a user-authored `/reload-ext` at seq 44, but it produced the real model's RECEIVED at seq 50 rather than running the registered extension command. An agent-authored tell wrapped the text and likewise reached the model. Changing the fixture extension file then sending this command did not load the updated request probe. Workaround: spawn a fresh disposable fixture parent after editing the loader. Owning tool: BB Pi provider command dispatch, or its RPC invocation of Pi; cause not established. Origin: [[projects/mlegls-pi/issues/drop-reconciler-worker-notices-in-a-bb-plugin]].
