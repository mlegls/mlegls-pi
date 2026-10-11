---
stage: idea
assignee: agent
author: session:689355dc-9bf6-4a86-859a-c290aa8614e3
priority: 3
---

A supervisor-owned prerequisite needs a way to hold its existing worker without the worker starting a dummy process or repeatedly raising an exception.

During [[projects/concept/issues/author-and-publish-the-language-learning-template]], the supervisor told implement-1 to wait for its main → prod promotion, estimated at an hour, and said it would retry the worker after deployment. The worker's own preparation and live-model rehearsal had finished; its local services were stopped. It reported `waiting — supervisor production promotion at aaa90230`.

At 2026-10-11 06:07:38 UTC the reconciler sent: “You reported `waiting`, but your session runs no managed process … Check it (process list, process output) … start it again if it didn't run, and continue.” `process list` confirmed fourteen finished or killed local processes. The promotion was never a worker-owned process, and the worker was explicitly prohibited from deploying production itself. No promotion result had arrived.

Owner: `lib/reconcile` waiting/status handling. Workaround: report `needs-input` for the supervisor-owned prerequisite instead of process-based `waiting`; whether that holds the existing worker without another handler remains unobserved. Decide whether such a hold belongs in the status protocol or in the supervisor's scheduling, rather than relaxing local-process liveness detection. [[projects/mlegls-pi/issues/reconciler-drive-continuation-loses-managed-process-ownership]] covers the related, already-resolved local-process checkpoint problem, not this external-prerequisite case.
