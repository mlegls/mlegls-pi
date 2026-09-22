# Tracker lifecycle

Agreed direction, 2026-09-22. Pending migration: the current vault adapter, parser and views still use `next`. This document records the replacement contract; it does not activate it for existing issues.

## Readiness and scope

idea → goal → spec → ticket → done → archived describes states, not mandatory steps. Scope is independent of stage; any stage may have children. An idea is recorded intent or an observation, a goal has an agreed destination, a spec authorizes autonomous realization and decomposition, and a leaf ticket is a bounded, one-session executable assignment. Unresolved implementation choices do not prevent a spec from being agent-ready when intent and delegated authority suffice. Specs and tickets permit autonomous work without further human decisions; research, measurement and other non-coding assignments can be tickets too.

Skip stages when the work warrants it. A bug fixed immediately needs no issue. Deferred observations start as ideas, but their bodies may already contain executable contracts: triage can promote an idea directly to a ticket without rewriting it or opening a separate triage session.

An authored issue represents a container and a virtual residual-work child, @self. Its stored stage describes obligations not delegated to explicit children; effective readiness is the meet of that own stage and the children's effective stages. A leaf's own and effective stages coincide. A ready sibling remains dispatchable even when an ancestor is not. Views must distinguish own readiness from subtree readiness.

Decomposition conserves scope: extracting a research ticket leaves deciding and realizing its consequences in @self or another child. Finding information and realizing its consequences are distinct bounded tasks. Dispatch executes residual work as well as explicit children, respecting dependencies. If all obligations are delegated, @self contributes nothing to readiness; the exact empty representation is still to be chosen, and is not done (which means a result exists). Separate residual work into a real child when it needs its own assignment, dependencies or context.

Dispatch commits to finishing the entire selected subtree, recursively dividing and conquering as needed. Before dispatch, refine unresolved children or move them outside that scope. Failure to complete is an exception requiring recovery, not an ordinary partial-success convention. New issues discovered during execution start a separate idea tree rather than expanding the execution-ready tree. That does not excuse leaving the dispatched contract unsatisfied.

Done means a result is available for review or digestion; archived means the issue has fulfilled its purpose. Review and digestion can be autonomous and belong to the owner of the enclosing purpose, not automatically the human. Research results are incorporated naturally; no receipt paragraph is required.

## Frontmatter direction

```yaml
stage: idea
assignee: agent
author: session:<origin>
claimed-by: session:<holder>
part-of: "[[projects/<repo>/issues/<parent>]]"
blocked-by: []
priority: 2
```

Stage values: idea, goal, spec, ticket, done, archived. Stored stage is own readiness; subtree readiness is derived. part-of is the single execution parent; blocked-by records actual prerequisites.

Priority expresses scheduling preference: 1 urgent, 2 main, 3 nice to have, 4 deferred. Assign it to the particular work rather than automatically inheriting a parent’s importance. For frictions, use the observed impact; missing impact evidence is uncertainty, not proof of minor severity. Classification can propose priorities, while deliberate deferral is a scheduling decision. Deferred work is excluded from automatic dispatch unless explicitly selected; it can be fully ready. “After launch” as preference is priority 4, not a fake dependency. The absent-priority default remains to be settled.

Author is immutable provenance, separate from eligibility and current ownership. Capture the originating human or agent session so reports can be traced back to evidence. Do not invent authors for historical issues whose origins are unknown.

Assignee is an eligibility filter, not necessarily an identity. Examples:

- agent: any agent
- human: any human
- model:fill or model:technical: a routing group
- user:mlegls: a particular human
- session:<id>: work must resume from exactly that session's context

An actor excluded by assignment must not undertake the work. Assignment is also a routing hint and generalizes to multiple humans. Stage and assignment are independent: a human-assigned ticket is executable but reserved for a human; assigning an idea to a model group does not make it execution-ready. A supervisor cannot silently bypass eligibility when delegating.

Claimed-by identifies the session actively touching the issue, with a resolvable mailbox for coordination. It does not replace assignee. Releasing or clearing a stale claim preserves assignment. A missing assigned session requires explicit reassignment or context recovery; it does not make the issue available to arbitrary workers. Session references should resolve to durable transcript context and a mailbox when live; a stored claim alone does not prove liveness.

## Attention and activities

Do not store a separate for-agent/for-me axis. Specs/tickets authorize autonomous work; earlier stages need shaping, not necessarily human attention. Route by comparative competence and authority, not decision difficulty. The maintainer’s interface is the program theory, intended stories and promises; agents own technical realization within that interface. See the decision-authority guidance in the delivery documentation. Agent-ready portions of pre-spec work become child specs/tickets.

Mine is the human frontier, not every early-stage ancestor. An idea/goal may currently await only research children and need no human attention. Frontier combines readiness, dependencies, eligibility and claims; done work needs review/digestion by its owner rather than automatically entering Mine.

The direction is to remove next as a second workflow axis. Research, grilling, prototyping and measurement describe how a hole can be resolved: record them beside the hole, or as independently executable child contracts. Triage is the entry activity for deferred observations and suspect/stale intent, not a mandatory intermediate stage. No separate ticket type is justified yet merely to duplicate these activities.

## Tree, indexes and triage

part-of is executable decomposition, not thematic membership: unreadiness propagates up and execution recurses down. A large finite scope may be one coherent issue; a thematic collection need not be an execution parent. Curated index/view pages explain multifaceted relationships without affecting readiness or dependencies. Issues can occur in several indexes. Index links are authoritative; an optional generated indexes frontmatter field is only their reverse index for filtering.

Triage the tree before composing indexes, preserving candidate associations and useful campaign prose along the way. Calibration concerns one node plus enough context to judge its edges, not its whole subtree:

1. Is it still relevant, fulfilled, superseded, obsolete or uncertain?
2. Does one coherent purpose and frontmatter interpretation apply? Otherwise split, merge or reorganize first.
3. What own stage, assignment, priority, provenance, dependencies and claim are justified? A leaf ticket must fit one session; larger settled work can be a spec.
4. What is its execution parent, which child edges are misplaced, and which index associations matter?
5. What in the body is stale, contradictory or insufficient? Stale implementation references alone do not make settled intent human decision work.

Deterministic code handles structural facts and rollup. A calibrated classifier can propose document dispositions and flag contradictions; code/history reconciliation requires investigation. Whether a document states a contract and whether that contract remains needed are separate judgments.

## Why next is insufficient

The September 21 Concept orientation (session 2026-09-21T05-52-40-925Z_01a0c286-0fdd-701c-80dd-f1ddd6f1f041, JSONL line 61) found bound-convex-reads-over-retained-history marked implement while its body required grilling remaining seams, and a wait issue about capture.ts after that file had already been deleted. The same session successfully changed grill to implement when a concrete decision and shape were recorded. Readiness must reflect the contract rather than a guessed next activity.

The September 21 harness friction triage distinguished actual defects from caller errors, already-fixed behavior, duplicates and accepted limitations; see mlegls-pi/docs/research/session-friction-triage-2026-09-21.md. The old rule that raw frictions receive next: simplify incorrectly admits untriaged observations to the execution frontier.

## Migration work still open

- Implement schema validation, readiness rollup, eligibility and claim handling together with CLI queries and Obsidian Tracker, Graph and Base views.
- Settle exact group-membership/routing resolution, durable session-reference syntax, absent-assignee defaults/inheritance, the no-residual-work representation, priority defaults, generated index membership, and how completion/archival is represented separately from readiness.
- Reconcile issue bodies and current code/results; do not mechanically translate next values into stages. Preserve links and provenance. Decide project/archive migration scope before bulk edits.
- Update tracker procedures and consumers together; remove the current raw-friction-to-simplify rule when the replacement is active.
