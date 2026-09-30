---
stage: done
author: session:01a0e1f9-7532-7020-9cfb-1028c0d6c727
---

While implementing [[projects/mlegls-pi/issues/archive/supervise-detects-unstarted-workers]], the worker instructions required reading the peer board before editing the shared `lib/jobs/supervise.ts` seam. This worker exposed only the bash adapter; `ab --help` offered no board read, and `ab lib --help` said host-bound board modules fail here. I could not read or acknowledge peer messages before editing. The isolated worktree kept the canonical checkout untouched, but there was no coordination-channel workaround. Expose board read/ack in this worker context or provide an equivalent CLI.

On 2026-09-27 in `dsh-scratch-state`, the same board API remained unavailable; `board --help` exposed issue-tracker commands (`submit`, `list`, `show`), not peer-message reads or acknowledgements. I worked from the ticket and recorded spike decision instead. The old friction remains unresolved.

## Observation — 2026-09-27

A later bash-only worker read the run topic via `bun -e` and `lib/board/store.ts`'s `read` export, recording the read with `noteRead`. This satisfied pre-edit inspection, but could not acknowledge messages: `board.ack` updates the Pi session's host-backed seen state. Direct store access is a read workaround; host-backed acknowledgement or a CLI remains open.

In `dsh-templated-spawn-and-dispatch`, `ab lib board read '{"topic":"dsh-port/*"}'` succeeded, but `ab lib board ack '["mujob4x8-dymx7g","mujrzq7s-b4uk7x","mujshwkv-vkrbpe"]'` failed with `board.ack is not a function`. Reading and posting work through the CLI adapter; acknowledgement still has no bash equivalent. Origin: session:01a0e2d3-2fe3-706a-8616-9394e05449d1.

The landing-design consolidation worker reproduced the adapter split on 2026-09-27: `ab lib board read '{"topic":"loop-review-the-landing-design/*"}'` returned all ten messages; acknowledging their IDs with `ab lib board ack` failed with `board.ack is not a function`. The worker inspected the read result before editing its isolated worktree; acknowledgement has no workaround. Origin: session:01a0e457-df23-776f-ab1d-15bd63960ab9.

2026-09-29, Concept `find-why-clerk-testing-tokens-fail-signed-in-browser-specs` (`01a0ebc3-a6f0-759f-9eec-011ac3e74f8b`): the `board` CLI on PATH rejected every call with `identity: AGENT_REALM is invalid`. The spawned worker had no `AGENT_REALM`. The ticket had no shared seam, so nothing was blocked. Its suggested fixes: export a working `AGENT_REALM` to spawned workers, or have the spawn prompt say the board is unreachable.

result, 2026-09-30: acknowledgement only settles subscription delivery inside a pi session, so a bash worker has nothing to acknowledge. `agents/_common.md` now gives the bash forms (`ab lib board read`, `ab lib board send` with `from`), says there is nothing to ack without exec, and names the PATH `board` as an unrelated tracker; `ab lib --help` no longer calls board host-bound.
