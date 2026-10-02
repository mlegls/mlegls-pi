---
stage: done
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


## Result

`bin/heavy` (on PATH through system-config's `home/.local/bin/heavy`, with `parallel` added to its flake): `heavy [-b] CMD [ARG...]` waits for one of `HEAVY_SLOTS` (default 2) host-wide FIFO slots, then runs CMD in the caller's own process tree. GNU parallel's `sem --id heavy --fg` instead of pueue: under pueue the job is the daemon's child, so the process tool, `retire`'s leftover-process cleanup and a cancelled caller don't reach it without traps in every caller; with sem, output, exit status and cancellation are the caller's own, and there is no daemon to keep alive. `-b` adds `taskpolicy -b`.

A waiting `sem` ignores SIGTERM (GNU parallel's "finish gracefully") and still runs its command once a slot frees; INT, HUP and KILL cancel it. Supervisors stop process groups with TERM first, so the wrapper forwards TERM to sem as INT.

Not done here: concept declaring its heavy commands. Its batch runner is on the garden root's branch, so `heavy -b` is a line in [[projects/concept/issues/declare-a-main-verification-task-and-drop-pre-integrate-owner]]. Scoped spec runs and seeds are left unwrapped: a FIFO would put a one-spec review run behind a 30-minute batch.

## Evidence

`/tmp` scripts at `HEAVY_SLOTS=1`, isolated `PARALLEL_HOME`, then the installed command:

- two callers in different directories: the second started when the first ended; exits 3 and 5 each to their own caller; an argument with a space and the caller's cwd survived.
- TERM to a waiter: status 255, its command never ran. Bare sem in the same position ran it.
- TERM to a holder: its job gone, the next caller admitted in 0.11 s.
- KILL to a holder (the wrapper alone, not its group): the slot freed (sem detects the dead pid), but the job was orphaned until it exited. Not forwardable; group kills reach it.

Not checked: real concept batches through it, and `-b`'s QoS beyond `taskpolicy` accepting it.

## Danger

**Door:** two-way. Nothing calls `heavy` yet.
**Blast radius:** local. One more package in the profile.

Holes carried on: the slot count is a guess until a memory sample during a busy period after concept's f58edb6f; whether worker admission shares the pool is now a note on [[projects/mlegls-pi/issues/admit-workers-against-a-host-wide-budget]].

2026-10-02: `-b` is wrong for browser batches: background QoS starved timers in concept's `quiz-custom-next.spec.ts:103` (15 ticks, wants >20). Use it only for work that measures nothing about time.
