---
stage: spec
assignee: human
author: session:01a0e1fe-0bf2-7778-be0c-d6d1816ed631
part-of: "[[projects/mlegls-pi/issues/scripted-supervision-loop]]"
---

Evaluate `ab supervise loop` (B) against the supervision tree (A), following Huntley on Ralph: "What's the opposite of microservices? A monolithic application. [...] Ralph works autonomously in a single repository as a single process that performs one task per loop."

B is bulk-synchronous. Each iteration is:

- find parallel mappable execution chunks (a triage call over the ready frontier)
- dispatch; if any can't be done, defer to next iteration

Integration happens at the barrier, and nothing else runs meanwhile, so it stays mechanical. Exceptions never wake anyone: the child is deferred with its branch kept, and recorded in a loop-scoped ledger. The next triage reads that ledger, and the ledger doubles as triage's journal. Holds (tickets that need their author) are skipped until the ticket file changes. Without a target the whole tracker is in scope, and the loop idles until `docs/issues` changes. Implementation: `lib/jobs/loop.ts` over supervise's batch mode.

A and B share the issue graph: readiness is a meet over children, and execution never lowers readiness. So the comparison is about exception handling: local and immediate without unwinding (A, a condition system with restarts) vs. global and batched after unwinding (B). A stateless-handler variant of A (C: spawn a fresh handler scoped to the parent, escalate through a condition chain) is a knob on A's owner context, and worth trying only if A beats B.

## Protocol

Two comparable subtrees, one near-leaf routine and one design-heavy, crossed over: A on X and B on Y, then swapped, each from the same base in a separate clone. Hypotheses:

- B costs less on coordination with no drop in acceptance rate.
- A wins where design judgment is needed mid-flight: measure join failures caused by sibling incoherence, and the rework they cause.
- B's cost is re-deciding: count triage decisions that reverse or repeat earlier ones despite the ledger.
- The barrier's cost: idle slot-time per iteration.

Metrics: total and coordination $, wall clock, slot utilization, tickets accepted, redispatches, conflicts, human interrupts, and a blinded audit-mode verify of each final branch plus defects found later.

## Known gaps in B (noted while hacking, 2026-09-27)

- Triage runs through `pi -p`, which records no token usage, so coordination cost isn't measured yet. Use `--mode json` or equivalent before the eval.
- Holds and their questions live in the loop state and ledger, not the tracker. The questions should land in the issue itself, where the author is looking.
- No join step: a non-leaf's own acceptance (verify(N) when its last child lands) isn't run, and B only schedules leaves.
- A deferral retires the worker: uncommitted work is lost, and a retry starts from main rather than from the kept branch.
- The tracker's in-flight overlay knows supervise jobs but not loop jobs, so a concurrent supervise run or a human could claim a ticket the loop's batch holds.
- A loop started from a shell has no parent session, so its workers aren't attached in `ab tree`.
- Startup-check exceptions are disabled in batch mode (a false "not started" killed a working verifier in the first trial). A dead worker holds its slot until the timebox.
- The daemon imports job modules once; changing `lib/jobs/*.ts` needs `ab daemon shutdown`.
