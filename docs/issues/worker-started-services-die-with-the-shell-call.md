---
stage: idea
assignee: agent
author: "session:01a0e5e9-67b7-732e-90ce-7e6ac7a4ad76"
---

Services a supervised worker starts from a bash tool call are killed when that call returns, even when they're backgrounded with `&` or `nohup`. Examples are Concept's `convex dev` / local backend, Vite and Storybook. The next call finds the port dead. In Concept's drive phases this showed up as Convex and dev-server timeouts that looked like load problems. Workers got around it by keeping everything inside one long call or by opening a tmux session through `cyber-mux`. Some services also leaked the other way: after their jobs moved on, orphaned `convex-local-backend`/Vite trees whose parent had exited (ppid 1) had to be pruned by hand.

Done when a worker has one documented way to start a long-lived service that outlives the call and is owned by the job, for example a job-scoped process group that is reaped when the phase ends. Dispatch guidance should point to that way. Covering both halves stops the premature deaths and the orphans.
