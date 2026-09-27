---
stage: idea
author: session:01a0e1f9-7532-7020-9cfb-1028c0d6c727
---

While implementing [[projects/mlegls-pi/issues/supervise-detects-unstarted-workers]], the worker instructions required reading the peer board before editing the shared `lib/jobs/supervise.ts` seam. This worker exposed only the bash adapter; `ab --help` offered no board read, and `ab lib --help` said host-bound board modules fail here. I could not read or acknowledge peer messages before editing. The isolated worktree kept the canonical checkout untouched, but there was no coordination-channel workaround. Expose board read/ack in this worker context or provide an equivalent CLI.
