---
stage: ticket
assignee: agent:technical
author: session:01a12f4c-1aa6-75fe-9c2b-d81acad80dbd
part-of: "[[projects/mlegls-pi/issues/reconcile-github-tracked-projects]]"
priority: 2
---

The reconciler reads and writes issues through a `Tracker` interface whose state is global: the same from every checkout and branch. How a backend stores it is its own business. The vault is the first backend; [[projects/mlegls-pi/issues/github-issues-as-a-tracker-backend]] is the second.

Today `lib/reconcile/reconcile.ts` runs `issues.ts snapshot --json` in each checkout (owner, collectors, worker worktrees) and depends on each branch having its own copy of `docs/issues/`. That copy does three jobs, each made explicit here:

1. **landed in a collector ≠ done.** A leaf's `stage: done` commit lands in `tree/<parent>`, so main still sees it open and an outside dependent doesn't start without its code. → a node is done only when its code reaches the reconciler's target (the owner's checkout); collector landings go in a **landing ledger** in reconciler state, which `inflight.ts` reads to show them as derived claims.
2. **scheduling inside a tree.** A sibling blocked by another becomes frontier from the collector's copy. → inside a tree, a blocker is satisfied when done, or ledger-landed in the same collector.
3. **provisional decomposition.** A refiner's children vanish with its branch if it fails. → children are written to the tracker at once, claimed by the run; children of a refine that fails or is replaced are removed by the reconciler unless the retry adopts them.

Removed with the per-branch view: `catchUp`, the `trackerParses` landing gate (backends validate on write), `close()` committing on the landing branch, the per-path `snapshot` cache and `ticketText(issue, from)`, the tracker-append special case in `lib/dispatch.ts` `integrate` (`appendUnion`), `setAsideIdeas` committing per branch.

decisions:
- 2026-10-12: global semantics, including the vault (maintainer).
- 2026-10-12: done means landed in the reconciler's target, not in a collector; the ledger carries the rest.
- 2026-10-12: the target is the reconciler's owner checkout, also when that isn't the main worktree (maintainer).
- 2026-10-12: no migration feature for reconciler state from before the ledger; a run alive at cutover gets its ledger rebuilt by hand from its collector branches (maintainer: single user).
- 2026-10-12: the vault's single copy is `docs/issues/` in the main worktree of the repository's git common dir, which `~/obsidian/projects/<repo>` already links. The CLI resolves it from any worktree. Writes edit that working tree; committing is only persistence, path-limited to the issue files a write touched.
- 2026-10-12: worker worktrees carry no `docs/issues/` (sparse checkout at worktree creation, `lib/thread/runtime.ts` and the collector's `worktree add`), so no agent edits or reads a stale copy. The landing gate refuses a branch that changes `docs/issues/` anyway. `docs/attachments/` evidence stays with the code.
- 2026-10-12: `issues.ts` gains write verbs (create, update fields, close with result, remove), so prompts and skills say "through the tracker" and are backend-agnostic; the GitHub backend implements the same verbs.
- 2026-10-12: `update(slug, fields, body?)` also replaces an existing issue's whole Markdown body; body-only updates are allowed. CLI: `update --body-file`; the GitHub backend maps it to `gh issue edit --body-file` (refiner proposal, supervisor approved on the run board).

shape:

```ts
interface Tracker {
  snapshot(scope?: string): Map<string, Issue>      // today's snapshot --json rows: stages, readiness, blockers, claims, selectors
  text(slug: string): string                         // the contract, for prompts
  fields(slug: string): Record<string, unknown>       // frontmatter-equivalent, e.g. drive: none
  create(issue: NewIssue): string                     // returns its slug
  update(slug: string, fields: Partial<Fields>, body?: string): void // fields and/or whole body replacement
  close(slug: string, result: { summary?: string; evidence?: string }): void
  remove(slug: string): void                          // provisional children only
}
// State gains: landed: Record<slug, { into: string; head: string; at: string }>
```

The reconciler takes its backend from the project (the tracker skill's rule: `docs/issues/` means vault). The tracker skill's procedure changes with it: a ticket's completion no longer rides its implementation branch, and friction is filed straight into the tracker, not on the branch. Role prompts (`agents/roles/`, `agents/reviewer.md`, `agents/tidy.md`) write through the tracker.

## Execution contracts

The committed seams are `lib/tracker.ts` (`Tracker`, snapshot DTO, `getTracker(cwd, options?)`) and `lib/reconcile/tracker-state.ts` (`LandingLedger`). The factory is a stub until child 1 fills it. Operations are synchronous, like the current subprocess observation. Fields use frontmatter-equivalent keys, but `part-of` and issue entries in `blocked-by` are logical slugs; guards remain opaque strings. Backends serialize their own relations. Null in an update removes a field; the stored vault YAML never gets a null stage. Markdown body input excludes frontmatter; `text` returns the complete prompt contract. No reconciler consumer opens `Issue.file`, an optional backend locator.

CLI contract (JSON fields use the same logical relations):
```text
issues.ts text <slug>
issues.ts fields <slug> [--json]
issues.ts create <slug> --fields '<json>' --body-file <path|->
issues.ts update <slug> [--fields '<json>'] [--body-file <path|->]
issues.ts close <slug> [--summary <text>] [--evidence <repo-relative-path>]
issues.ts remove <slug>
```
`create` prints the resulting slug; mutation success is exit 0 and failure is nonzero with a diagnostic. Queries retain today's JSON schema. `fields` prints JSON, with or without `--json`. A body file is resolved from the calling cwd, not the canonical checkout; `-` reads stdin. Updates merge metadata and preserve the body unless replacement was supplied. Mutations validate the resulting tracker before publication and persist only their touched issue paths in the canonical checkout, never unrelated staged work. Non-git vaults retain upward directory discovery and omit git persistence.

The ledger's `into` follows `Chain.into`: collector issue slug, or the absolute owner checkout path. `head` is the destination's post-integration code head, `at` is ISO-8601. Landing a collector moves the pending entries it carries into the next destination; only entries reaching the owner checkout may be closed. Keep entries for restart/idempotence and display pending ones as derived claims.

Provisional children are created with `claimed-by: reconcile:<root>/<refine-handle>` in the same write that creates them. The reconciler supplies that token in the refine prompt, records the pre-attempt subtree, and owns cleanup only for new children with its token. A continuation/retry may explicitly adopt those children; successful decomposition converts the attempt claim to the run reservation `reconcile:<root>` after its stubs land, retained until target close or move-out. Unrelated issues and pre-existing children are never removed. Role text in child 3 follows this token contract; child 2 owns the state and cleanup.

## Children

1. [[projects/mlegls-pi/issues/global-vault-tracker-backend]]: canonical CLI/backend and filled sparse/refusal helpers. Keep these runtime helpers dormant until 2: activating them while the old reconciler still reads/closes branch-local issues would make the intermediate integration red.
2. After 1, in parallel:
   - [[projects/mlegls-pi/issues/reconcile-with-global-tracker-and-landing-ledger]]: atomically activate sparse workers/collectors and landing refusal while replacing branch-local state/scheduling/close, remove tracker append unions, add provisional refinement and inflight ledger projection, provide the runnable scratch rehearsal.
   - [[projects/mlegls-pi/issues/write-tracker-through-global-api-in-agent-instructions]]: tracker references and agent-facing instructions.

## Residual edit contract

Once these children land, this ticket owns their join, not another implementation of them. Remove any remaining stub, repair mismatched CLI/type/prompt seams, and run the existing reconciler and tracker suites together. Use child 2's committed rehearsal to drive the crossing stories below from the combined revision; record the encounter under `docs/attachments/reconcile-against-a-global-tracker/` per [verification evidence](../verification-evidence.md). First use is an isolated scratch git repository with its own vault, board, thread state and shell workers, not this live campaign or another user's tracker.

Cutover: validate the new package/CLI from this checkout in scratch first; do not hot-swap a live pre-ledger reconciler halfway through this campaign. After integration the supervisor restarts/reloads the installed package and agent instructions. A pre-ledger live run requires the already-decided manual ledger rebuild, not an automatic migration feature.

## Stories and acceptance

Existing `lib/reconcile` and tracker script tests pass, rewritten where they encoded per-branch behavior. Keep their surviving properties; don't add retained tests without approval (`testing`). Drive on a scratch repository with a vault tree: a spec root with tickets a and b, b blocked by a, and an outside issue blocked by a.
- b starts after a lands in the root's collector; the canonical tracker shows neither done, and a as in flight, until the root lands; then a, b and the root are done and the outside issue is frontier.
- a refine that fails after creating children leaves none behind.
- a worker worktree has no `docs/issues/`, and the tracker CLI run inside it reads the canonical tracker.
