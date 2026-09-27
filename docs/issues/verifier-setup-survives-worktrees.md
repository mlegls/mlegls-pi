---
stage: ticket
assignee: agent
author: session:01a0e1a4-3d08-7254-a111-e7468d67a03e
---

Three of four dsh-port verifiers on 2026-09-27 (hashline spike, ptc-shell-and-transform-edits, memory-compaction-provider) ended `blocked` with every story `unobservable`. In each case the implementer had prepared state that the fresh verify worktree didn't have: a provider overlay, a diagnostic plugin, long-history sessions. Implementers keep that state in ignored paths (`dsh/.local/`), and it disappears with their worktree. Each verifier rediscovered the setup or gave up; the first also reported `blocked` only because the visual review was still pending, which is the loop's next phase, not something that blocks the verifier.

Done when the implement prompt in `lib/jobs/supervise.ts` (`SETUP`/`HANDOFF`) requires setup a verifier needs to be committed or reproducible from committed scripts (secrets referenced by env var name only), and the verify prompt says to drive the encounter from committed setup plus the environment, recreating state rather than expecting it, and that a pending visual review isn't a reason to report blocked. `lib/jobs/supervise.ts` is also being edited on main for batch mode (ea6d370, 56efa50); rebase onto it.
