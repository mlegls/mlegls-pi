# Tracker lifecycle

Active contract, 2026-09-22. Issues retaining `next` remain explicitly legacy: read/check only, without lifecycle readiness or frontier. Migration reconciles contracts and results; it never translates `next` automatically.

## Stage and scope

idea → ready → done describes states, not mandatory steps. The one boundary is `ready`: there is enough consensus on what's to be done that the rest happens autonomously. An issue is ready when it states the motivating situation and desired outcome, the human choices in it are closed (an approved prototype if it renders something new), it names the observable check that proves it worked, and no human or external blocker remains. How many sessions it takes and which children it splits into are execution details, not consensus. Everything before the boundary is an idea, from a raw capture to a decided want still being shaped; its assignee says who moves it next. Scope is independent of stage; any stage may have children. Each stage adds to the body before it ([body](issue-tracker-vault.md#body)). Ready work too big for one session says `decompose: true`: the reconciler starts it with refinement, and an implementer who finds an issue bigger than one session sends it back there (respec). Research, measurement and non-coding work can be ready issues. Skip stages when warranted; immediate fixes need no issue.

The tracker still reads the names it used before 2026-11-23 (`goal` as idea, `ticket` as ready, `spec` as ready with `decompose: true`) and moves a stored one to its current name on the next write to that issue. Writes that name an old stage are refused.

The stored stage describes residual work (@self), not delegated children. Effective stage is the recursive meet of own and child stages in the order above. Omitted `stage` means no residual work, requires children and contributes neutral done; explicit null is invalid. Archived children contribute neutral done and cannot parent live work. An own-done parent with unfinished children is not complete. A ready sibling remains independently dispatchable even when its ancestor is not ready.

Decomposition conserves scope: extracting research leaves deciding and realizing its consequences in @self or another child. Separate residual work into a child when it needs independent assignment, dependencies or context. Dispatch commits to completing the selected subtree recursively. Refine unresolved children or move them outside that scope before dispatch. During execution, refinement is monotone and scope-conserving: the session executing a node may clear its `decompose` and add ready children that partition its residual work, but agent refinement never lowers an existing node and no new intent enters the tree. Decisions reached in a review or feedback loop are written through the tracker immediately, not held in the artifact until asked. Discoveries that need a decision or a session of their own start a separate idea tree rather than expanding an execution-ready contract; a defect whose fix is evident and smaller than its issue would be is fixed in place and needs no issue (the two-minute rule). A node found to need shaping is parked with its honest stage, `assignee: human`, and the problem and a recommendation in its body, retaining `part-of`. Its siblings can continue; its parent waits. The reconciler's `move-out` resolution records the park and releases its claims. Reassigning it to an agent once shaped resumes it in the original tree.

Done means recorded acceptance is satisfied and a result exists for review or digestion; code has actually reached its owner's target. A local reconciler's target is its owner's checkout, which need not be the main worktree. PR modes stage independently; their target is the captured remote base, proven by a MERGED receipt and fetched ancestry before close. Under a reconciler, only it closes with the result after target landing, not on a worker's report or collector landing. Standalone resolution also waits for recorded acceptance and actual target landing. Live done is distinct from execution. Archiving moves a `stage: done` issue to `archive/` once it has fulfilled its purpose; there is no archived stage.

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

Stage is optional idea/ready/done; `decompose: true` on a ready issue starts its execution with refinement. `part-of` is the single execution parent, not thematic membership; `blocked-by` contains actual prerequisites. Research, grilling, prototyping and measurement describe how a hole is resolved, in its body or an independently executable child, not another workflow axis.

Besides other issues, an issue can be blocked by a time or a condition, written as a quoted `"<tag>: <value>"` guard: `"after: 2026-10-01"`, `"merged: <PR url>"`, or `"ready: [[…]]"` for something only blocked on another issue getting to ready rather than on its implementation. Tags are added lazily as needed and stay opaque to the tracker: a guard blocks like an open prerequisite until whoever finds it satisfied removes it, and the reason lives in the body. Entries are conjunctive, so a timeout that should prompt a different action (following up with a maintainer) is a separate issue blocked by the date. A condition nobody can check without judgment is an issue, not a guard. Obsidian does not index links inside guard strings.

Drive, a blind first user between implement and review, runs where its information barrier pays for itself: when the change touches a user surface the repository declares in a committed `.pi/reconcile.json` (`renderedPaths`, plus non-rendered surfaces such as CLIs and journeys in `drivePaths`), or when the issue says `drive: always`. Otherwise the reconciler goes implement → review. An issue whose acceptance is observable only after landing (a migration that runs on deploy, a CI or deploy fix) may say `drive: none`, which skips drive regardless; the body then names the post-landing gate that carries the acceptance and who owns it. Review stays. For automatic landing with acceptance pending, declare `post-landing` gates in ticket metadata (see `docs/verification-evidence.md` in mlegls-pi). The reconciler owner records the verdicts before close.

Priority is local and never inherited: 1 urgent, 2 main, 3 nice to have, 4 deferred. Absent means unknown, sorted after main and before nice. Deferred subtrees are excluded from automatic selection unless explicitly scoped. Deferral is preference, not a fake dependency; missing impact evidence is uncertainty, not minor severity.

Author is immutable nonempty provenance. New capture uses `session:<id>` or `user:<name>`; preserve historical values verbatim. The current session's id is `$PI_SESSION_ID` in agent shells; a session forked or continued from another has its own id, so read the variable rather than reusing one from context. Capture the originating session for new observations; omit unknown historical authors.

Assignment is local, never inherited, and independent of readiness:

- `agent`: any agent
- `human`: any human
- `user:<name>`: a particular human
- `session:<id>`: the exact session context; missing sessions require reassignment or context recovery
- `agent:<existing stance>`: named agent prompt/workflow
- `model:<provider>/<model>:<effort>`: explicit model override, resolved by routing

Only stance and model override may combine, in either order: `assignee: "agent:auto-routine, model:zai/glm-5.3-flash:high"`. Duplicate/conflicting components and bare aliases are invalid. Effort is none, minimal, low, medium, high or xhigh. Absent assignment is unknown; agents don't take it. Assignment records what the next step was thought to be when the issue was filed: `human` means an interactive session with the user, `agent` means agent work. Either can be filed wrong, so triage checks it. An issue that isn't fully decided (whether to do it at all, or a product choice within it) is `human`, since its next step is the session that decides; research or another agent subtask that would inform that session is an agent-assigned child it is `blocked-by`. Before ready, `agent` fits only settled intent whose remaining questions research, an experiment or shaping can answer. An idea waiting on evidence (a recurrence, a captured payload) says so in its body and waits for whoever meets that evidence to add it. Remaining selectors stay visible to routing; supervisors cannot bypass them.

`claimed-by` reserves the issue for its session or reconciler run; session claims name a bb thread for coordination. Claims and parent/blocker edits go through the tracker immediately. During refinement the worker commits proposed children under `.reconcile/proposal/children/`. On acceptance the reconciler creates them with `claimed-by: reconcile:<root>` until target close or move-out. It does not replace assignment. A stored claim does not prove liveness but conservatively blocks execution until explicitly cleared; lack of a worktree is not permission to take over. Session references should resolve to durable transcript context and a mailbox when live.

Work elsewhere claims too, derived rather than written (`scripts/inflight.ts`): every node of an unfinished reconciler run (stalled when its process is gone), a worker `dispatch` sent at an issue (recorded under the git dir while its worktree lives), a worktree branch ahead of the main checkout named for an issue, and pending collector landings in the reconciler's landing ledger. The ledger records destination, post-integration code head and time; collector and PR staging landings are pending, not globally done. PR inflight/status identifies mode, phase, URL when published, and the pending remote target. Within a tree, a blocker can be satisfied by a ledger landing in the same collector; outside dependents wait for global close at the owner's target. They show as `inflight:` in the listings and as claims with `derived: true` in the snapshot, and keep those subtrees off the frontier until they merge. A stalled run is a reconciler to restart (`reconcile` on its root, by its owner), not work to redo.

## Readiness and eligibility

Agent frontier selects live subtrees with effective stage ready, every remaining residual assignment permitting agents, and no unresolved external blockers or claims anywhere across that subtree. Internal dependencies are schedulable within the selected scope; cycles are invalid. Readiness and eligibility are separate. Own-done and no-residual containers contribute no assignment constraint to children. Frontier lists all independently eligible scopes; the supervisor chooses and deduplicates execution. Human mine selects explicit human/user residual assignments even at idea for shaping, applying own blockers, claim and priority rather than subtree constraints; early stage alone does not imply human ownership, but undecided intent does. Blocked human work remains visible in tree/inventory. Claims and blockers reserve work separately from readiness.

The CLI snapshot exposes own/effective stage, readiness, eligibility, blockers, claims, selectors and a separate legacy collection. Done live results are available for review/digestion, separately from frontier.

## Tree, indexes and triage

part-of is executable decomposition, not thematic membership: unreadiness propagates up and execution recurses down. A large finite scope may be one coherent issue; a thematic collection need not be an execution parent. Curated index/view pages explain multifaceted relationships without affecting readiness or dependencies. Issues can occur in several indexes. Index links are authoritative; an optional generated indexes frontmatter field is only their reverse index for filtering.

Triage writes go through the tracker. Settle already-fixed, caller-error and accepted-limitation captures with a closed disposition/result, or transfer evidence to the existing owning issue. Do not delete contracts during triage. New friction is filed outside the active execution subtree and linked from the report.

Triage the tree before composing indexes, preserving candidate associations and useful campaign prose along the way. Calibration concerns one node plus enough context to judge its edges, not its whole subtree:

1. Is it still relevant, fulfilled, superseded, obsolete or uncertain?
2. Does one coherent purpose and frontmatter interpretation apply? Otherwise split, merge or reorganize first.
3. What own stage, assignment, priority, provenance, dependencies and claim are justified? Ready work that won't fit one session says `decompose: true`. Is its next step still what its assignment says: agent work on an agent-assigned issue, a session with the user on a human-assigned one? An undecided issue assigned to agents, or settled agent work waiting on a human, is a possible misassignment.
4. What is its execution parent, which child edges are misplaced, and which index associations matter?
5. What in the body is stale, contradictory or insufficient? Stale implementation references alone do not make settled intent human decision work.

Deterministic code handles structural facts and rollup. A calibrated classifier can propose document dispositions and flag contradictions; code/history reconciliation requires investigation. Whether a document states a contract and whether that contract remains needed are separate judgments.
