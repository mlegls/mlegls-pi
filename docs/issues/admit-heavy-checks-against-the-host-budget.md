---
stage: ticket
assignee: agent
priority: 2
author: "session:95cf9e55-d246-406a-a3bc-f0780b3b2a49"
---

Browser batches, full builds and seeding run through a host-wide admission queue; background verification also runs at background QoS. From [[projects/concept/issues/streamline-validation-by-value-and-wall-time]]: the role trims there lower average load but don't bound it, since contention is concurrency × weight and nothing caps concurrency across owners. Session data shows concept's under-a-minute `pre-integrate` taking a median 6 minutes in sessions.

Sibling of [[projects/mlegls-pi/issues/admit-workers-against-a-host-wide-budget]]: that gate admits workers; this one admits the heavy jobs a worker starts (one worker can start several batches). Its evidence already says memory is the binding resource (swap 6 → 13 GB, about six browser workers as the practical limit), so a count limit, not priority, is the core; priority alone does nothing once swapping.

Buy, don't rebuild: `ab check`'s two-slot queue was a homegrown version, removed in b40cdec with open bugs about timeouts cancelling waiters and lost waiters (archived `ab-check-*` issues).

- pueue group `heavy` with `pueue parallel <n> -g heavy`; callers `pueue add -g heavy -p -- <cmd>` then `pueue wait`/`pueue log`. A thin wrapper on PATH so roles and project tasks say one word.
- `taskpolicy -b` for work nobody waits on (post-landing verify: [[projects/mlegls-pi/issues/verify-main-after-landing-instead-of-gating-the-owner-landing]]).
- Which commands count as heavy is declared by the project (e.g. its browser and seed tasks call the wrapper), not guessed from argv.

Done when two concurrent browser batches from different worktrees run one after the other at limit 1, both callers get their own exit status and log, and a cancelled caller frees its slot.

holes:

- The limit: sample `memory_pressure`/`vm_stat` during a busy period after concept's f58edb6f (before it, every `codegen:check` leaked a Convex local-backend executor, which inflated pressure).
- Whether this and worker admission share one token pool (jobserver-style) or stay two queues.
