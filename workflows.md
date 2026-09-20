# Session preparation

Policy for introduce and advance, read at call time by lib/prepare.ts. Model preferences live in routing.md; fixed reader/candidate defaults live in workflows.json.

## Introduce

Locate an idea or request in the existing project and related work. If already recorded, use that record rather than duplicating it. Establish what is agreed and what remains open. An unsettled destination calls for map; an agreed destination with unsettled behavior or shape calls for plan. Shaped work calls for implementation or its supervision. Stale intent calls for reconciliation before execution.

## Advance

Find one session-sized tracer bullet within the requested issue subtree, or the current project's tracker when no scope is given. It may span related issues or be one increment of a larger issue. Respect claims and blockers; an issue carried by open children is not another independent assignment. Include human decision work as well as the agent frontier. Prefer priority and transitive unblocks, subject to the user's current intent. Distinguish a completed or blocked frontier from a missing or unreadable tracker.

## Preparing the session

Broadly read first. Judge how knotty choosing the next move is, separately from how difficult it will be to implement. Easy selection restates settled tickets: a small model submits candidate-session prose through a typed tool, Jev selects one, and Jev selects relevant chunks of the broad reading. Hard selection needs a reasoning model to triage and return an assignment directly. That free-text assignment is returned verbatim, with no response schema or parser and no rejudgment by Jev.

Use exact carrying skill names: `map` for unsettled destinations, `plan` for shaping agreed goals, `implement` for a bounded agreed change, `realize` for supervising specified work, `orchestrate`/`compile` when their scope warrants them, `simplify`, `verify-story`, `vault` for reconciliation, and `grilling` for a bounded decision. Research, prototype and measure can be named stances when no installed skill carries them. Use `none` for idle. Read the applicable instructions rather than inventing a skill name.

Workflow names and tracker `next` values are different vocabularies. Use the tracker's actual conventions when an assignment calls for recording work; for the vault tracker, open goal/shape decisions use `next: grill`, not invented `next: map` or `next: plan` stages.

A session assignment names a concrete result, the carrying skill or stance, the first useful action, why this move matters now, and an observable stopping condition. If user decisions remain, make the discussion and its specific questions the session's work. Exhausted or blocked scope is a valid idle result; do not manufacture activity.

The current parent starts with this assignment and its working context rather than spending a turn deciding what to do. Include relevant project constraints, precedents, counterevidence, and source references. Remaining implementation discovery is legitimate work; repeating orientation is not. Surface stale tracker fields as part of the assignment rather than modifying them during preparation.

Preparation is read-only: no tracker edits, claims, implementation, or worker launches. The parent carries out the selected workflow, including any authorized dispatch. Model suggestions are optional advice for the user/harness, separate from the assignment. Continuing with the current model is always fine.
