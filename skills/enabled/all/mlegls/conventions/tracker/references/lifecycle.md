# Tracker lifecycle

Active contract, 2026-09-22. Issues retaining `next` remain explicitly legacy: read/check only, without lifecycle readiness or frontier. Migration reconciles contracts and results; it never translates `next` automatically.

## Stage and scope

idea → goal → spec → ticket → done describes states, not mandatory steps. Scope is independent of stage; any stage may have children. An idea records intent or an observation, a goal has an agreed destination, a spec authorizes autonomous realization and decomposition, and a leaf ticket is a bounded one-session assignment. A spec leaf may exceed one session; its decomposition belongs to its assignee. Research, measurement and non-coding work can be tickets. Skip stages when warranted; immediate fixes need no issue.

The stored stage describes residual work (@self), not delegated children. Effective stage is the recursive meet of own and child stages in the order above. Omitted `stage` means no residual work, requires children and contributes neutral done; explicit null is invalid. Archived children contribute neutral done and cannot parent live work. An own-done parent with unfinished children is not complete. A ready sibling remains independently dispatchable even when its ancestor is not ready.

Decomposition conserves scope: extracting research leaves deciding and realizing its consequences in @self or another child. Separate residual work into a child when it needs independent assignment, dependencies or context. Dispatch commits to completing the selected subtree recursively. Refine unresolved children or move them outside that scope before dispatch. During execution, refinement is monotone and scope-conserving: the session executing a node may make a spec a ticket and add spec or ticket children that partition its residual work, but no node's effective stage may decrease and no new intent enters the tree. Discoveries start a separate idea tree rather than expanding an execution-ready contract. A node found to need shaping is not lowered in place: its supervisor moves it out of the tree with its honest stage, `assignee: human`, and the problem and a recommendation in its body; adds it to the parent's `blocked-by` when the parent's acceptance depends on it; and continues with the rest. Re-attaching it once shaped is ordinary refinement.

Done means a result exists for review or digestion, which can be autonomous and belongs to the enclosing purpose. Live done is distinct from execution. Archiving moves a `stage: done` issue to `archive/` once it has fulfilled its purpose; there is no archived stage.

## Frontmatter

```yaml
stage: idea
assignee: agent
author: session:<origin>
claimed-by: session:<holder>
part-of: "[[projects/<repo>/issues/<parent>]]"
blocked-by: []
priority: 2
```

Stage is optional idea/goal/spec/ticket/done. `part-of` is the single execution parent, not thematic membership; `blocked-by` contains actual prerequisites. Research, grilling, prototyping and measurement describe how a hole is resolved, in its body or an independently executable child, not another workflow axis.

Besides other issues, an issue can be blocked by a time or a condition, written as a quoted `"<tag>: <value>"` guard: `"after: 2026-10-01"`, `"merged: <PR url>"`, or `"spec: [[…]]"` for something only blocked on another issue getting to spec rather than on its implementation. Tags are added lazily as needed and stay opaque to the tracker: a guard blocks like an open prerequisite until whoever finds it satisfied removes it, and the reason lives in the body. Entries are conjunctive, so a timeout that should prompt a different action (following up with a maintainer) is a separate issue blocked by the date. A condition nobody can check without judgment is an issue, not a guard. Obsidian does not index links inside guard strings.

Priority is local and never inherited: 1 urgent, 2 main, 3 nice to have, 4 deferred. Absent means unknown, sorted after main and before nice. Deferred subtrees are excluded from automatic selection unless explicitly scoped. Deferral is preference, not a fake dependency; missing impact evidence is uncertainty, not minor severity.

Author is immutable nonempty provenance. New capture uses `session:<id>` or `user:<name>`; preserve historical values verbatim. The current session's id is `$PI_SESSION_ID` in agent shells; a session forked or continued from another has its own id, so read the variable rather than reusing one from context. Capture the originating session for new observations; omit unknown historical authors.

Assignment is local, never inherited, and independent of readiness:

- `agent`: any agent
- `human`: any human
- `user:<name>`: a particular human
- `session:<id>`: the exact session context; missing sessions require reassignment or context recovery
- `agent:<existing stance>`: named agent prompt/workflow
- `model:<provider>/<model>:<effort>`: explicit model override, resolved by routing

Only stance and model override may combine, in either order: `assignee: "agent:fill, model:zai/glm-5.3-flash:high"`. Duplicate/conflicting components and bare aliases are invalid. Effort is none, minimal, low, medium, high or xhigh. Absent assignment is unknown and does not authorize agent execution. Remaining selectors stay visible to routing; supervisors cannot bypass them.

`claimed-by` identifies the session actively touching the issue, with a resolvable mailbox for coordination. It does not replace assignment. A stored claim does not prove liveness but conservatively blocks execution until explicitly cleared; lack of a worktree is not permission to take over. Session references should resolve to durable transcript context and a mailbox when live.

Work elsewhere claims too, derived rather than written (`scripts/inflight.ts`): each child of a running `ab supervise` loop, the children of a failed or stopped loop (orphaned: their agents run unsupervised), an issue integrated into a non-main supervisor checkout, a worktree branch ahead of the main checkout named for an issue, and an issue a worktree branch has at `stage: done`. They show as `inflight:` in the listings and as claims with `derived: true` in the snapshot, and keep those subtrees off the frontier until they merge. An orphaned claim is a loop to restart (`ab supervise start <slug>` by its owner), not work to redo.

## Readiness and eligibility

Agent frontier selects live subtrees with effective stage spec/ticket, every remaining residual assignment permitting agents, and no unresolved external blockers or claims anywhere across that subtree. Internal dependencies are schedulable within the selected scope; cycles are invalid. Readiness and eligibility are separate. Own-done and no-residual containers contribute no assignment constraint to children. Frontier lists all independently eligible scopes; the supervisor chooses and deduplicates execution. Human mine selects explicit human/user residual assignments even at idea/goal for shaping, applying own blockers, claim and priority rather than subtree constraints; early stage alone does not imply human ownership. Blocked human work remains visible in tree/inventory. Claims and blockers reserve work separately from readiness.

The CLI snapshot exposes own/effective stage, readiness, eligibility, blockers, claims, selectors and a separate legacy collection. Done live results are available for review/digestion, separately from frontier.

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
