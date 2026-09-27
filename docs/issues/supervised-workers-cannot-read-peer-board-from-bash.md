---
stage: idea
author: session:01a0e1f9-7532-7020-9cfb-1028c0d6c727
---

While implementing [[projects/mlegls-pi/issues/supervise-detects-unstarted-workers]], the worker instructions required reading the peer board before editing the shared `lib/jobs/supervise.ts` seam. This worker exposed only the bash adapter; `ab --help` offered no board read, and `ab lib --help` said host-bound board modules fail here. I could not read or acknowledge peer messages before editing. The isolated worktree kept the canonical checkout untouched, but there was no coordination-channel workaround. Expose board read/ack in this worker context or provide an equivalent CLI.

On 2026-09-27 in `dsh-scratch-state`, the same board API remained unavailable; `board --help` exposed issue-tracker commands (`submit`, `list`, `show`), not peer-message reads or acknowledgements. I worked from the ticket and recorded spike decision instead. The old friction remains unresolved.

## Observation — 2026-09-27

A later bash-only worker read the run topic via `bun -e` and `lib/board/store.ts`'s `read` export, recording the read with `noteRead`. This satisfied pre-edit inspection, but could not acknowledge messages: `board.ack` updates the Pi session's host-backed seen state. Direct store access is a read workaround; host-backed acknowledgement or a CLI remains open.
