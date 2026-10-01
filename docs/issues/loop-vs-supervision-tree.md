---
priority: 3
stage: spec
assignee: human
author: session:01a0e1fe-0bf2-7778-be0c-d6d1816ed631
---

Superseded 2026-10-01 by [[projects/mlegls-pi/issues/reconcile-the-execution-tree-with-lazy-exception-handlers]].

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

## Recursive loop (2026-09-27)

The loop had much lower throughput than the tree, which suggested reframing the tree version:

- the outer loop is the script, not an interactive supervisor, but it dispatches "top level nodes" in the sense of the interactive supervisor, rather than leaves
- each node is the same script, recursively until leaves
- nodes in this sense behave like the ralph loop script, in that they're only woken when *all* children are done, and with a fresh context, retriaging its children. this includes the top level, and the top level runs in a loop

Keys: structured concurrency (a node is a nursery), decomposable BSP / Multi-BSP (nested submachines sync on their own barriers). It's C with an empty journal that wakes only at barriers. Expected wins over the flat loop: barriers become local (a straggler holds only its siblings), collision reasoning becomes local (siblings were designed together; the flat triager picked 2 of 48 ready tickets), and the join lands at every node. The pressure point is a parent's barrier over a long subtree; stale synchronous parallel is the known relaxation, not used yet.

Built in `lib/jobs/loop.ts`: candidates are the target's direct children (the tracker's roots at the top): ready leaves, and nodes with ready work below. Leaves go to one supervise batch; each node runs as a nested loop in-process (state inside the parent's batch, ledger `loop-<node>.jsonl`), with half the parent's budget and the parent triage's note. A nested loop returns when its subtree has no ready work; if its children are all done it runs a final node join (crossing stories if the node links stories, consolidation of what's unjoined) and closes the node. The top-level triager (`triage`, Opus) organizes the whole cycle; nested loops use `node-triage` (GLM).

Found on the way: supervise gave workers the issue's absolute path, so workers in worktrees edited the owner's checkout and later merges failed; prompts now use repo-relative paths. And a restart between recording `integrated` and saving state resumed the landed child as unreachable; state is saved first now.

Drivers (2026-09-27, first two concept tickets): the useful tests came from the reviewer, not the driver. One driver never reached the Storybook surface (the implementer's entry was a menu path, not a loadable URL); the other wrote a smoke test plus a screenshot. The reviewer's tests were real, though one labelled black-box asserted markup. Testing vs. checking (Bach and Bolton): the driver now writes predictions before first use and records replayable checks, and the reviewer encodes those as tests of what the user observes. `verify` moved to gpt-6-sol high; try Sonnet 5.5 as the driver once it's out.

decision, 2026-09-30: run after the current supervise operational repairs land; collect delivery and cost evidence meanwhile. Orchestration defaults unchanged.
