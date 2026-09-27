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

## Pipeline roles (2026-09-27, branch pipeline-roles)

Both arms now run each leaf as implement → drive → review → integrate, with prompts composed from `agents/_common.md`, `agents/roles/<role>.md` and the agent body, so the per-ticket pipeline is the same across arms. In a first trial on a one-ticket scratch repo, the driver recorded two frictions (extra arguments silently ignored, multiline titles emitting several lines) and committed black-box tests. The reviewer fixed both, extended the tests and refreshed the packet, and the integration gate ran the tests.

- The loop can't tell harness failures from ticket problems. A deterministic launch error (an agent with a role but no routing.md criterion) was retried for three iterations, then held with a question to the ticket's author. Deferral reasons need a class, harness vs. ticket, and harness failures should stop the loop instead of the ticket.
- Stance criteria live in routing.md and agent descriptions separately; `prepareRole` now fails loudly when an agent declaring a role has no criterion, but the two sources can still drift.

## Joins (2026-09-27)

The join step: once a node's children, or a loop batch, have landed, an integration driver drives the node's own crossing stories (tree only) and `tidy` makes a behavior-preserving consolidation pass (`agents/roles/consolidate.md`). Leaf review is about behavioral correctness; the join looks for duplication between children, unnecessary or inconsistent abstraction, and opportunities for simplification. In the loop, cycles with fewer than two landings accumulate, and the next join covers everything since the last one.

Trial on a scratch repo of case converters, five tickets over four cycles:

- The triager repeatedly told parallel implementers not to extract a shared helper, since siblings would collide on it. That deferred duplication is exactly the join's job, so the loop creates the work its join does.
- With accumulation, a join over kebab/constant/title extracted `words.awk` (+16/−37) with outputs unchanged. It left the older snake/camel/slug scripts alone and missed that `kebab.sh` duplicates `slug.sh`: it stayed inside its diff. The role now asks it to search for existing code doing the same thing.
- Handoff fields were fragile in two ways that failed otherwise-accepted tickets: a nonvisual packet without `shots`, and prose under `tests` executed as shell. `tests` now names committed test files.
- Workers following the friction-filing rule appended observations to issues in this repository from scratch repos. Test runs need that rule scoped to their own repo.
- The tree's join drive (crossing stories) hasn't been tried yet; it needs a supervise run with an owner.

Escalation in the loop (2026-09-27): nothing interrupts the human. What a child would wake a tree owner about is deferred to the ledger, and the next triage retries or holds it. A hold now writes the question into the issue, sets `assignee: human` and commits that file, so the tracker is the inbox and frontier skips the ticket until it's handed back. Deferrals whose reason is a harness failure (launch failed, worker did not start, unreachable, resume failed, loop error) are counted instead, and two in a row, in one batch or consecutive ones, stop the loop with a `stopped` ledger entry.
