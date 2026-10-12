---
stage: spec
assignee: agent
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

shape:

```ts
interface Tracker {
  snapshot(scope?: string): Map<string, Issue>      // today's snapshot --json rows: stages, readiness, blockers, claims, selectors
  text(slug: string): string                         // the contract, for prompts
  fields(slug: string): Record<string, unknown>       // frontmatter-equivalent, e.g. drive: none
  create(issue: NewIssue): string                     // returns its slug
  update(slug: string, fields: Partial<Fields>): void // stage, part-of, blocked-by, assignee, claimed-by
  close(slug: string, result: { summary?: string; evidence?: string }): void
  remove(slug: string): void                          // provisional children only
}
// State gains: landed: Record<slug, { into: string; head: string; at: string }>
```

The reconciler takes its backend from the project (the tracker skill's rule: `docs/issues/` means vault). The tracker skill's procedure changes with it: a ticket's completion no longer rides its implementation branch, and friction is filed straight into the tracker, not on the branch. Role prompts (`agents/roles/`, `agents/reviewer.md`, `agents/tidy.md`) write through the tracker.

substeps (for refine; 1 first, then 2 and 3 in parallel):
1. vault backend: canonical resolution, write verbs, worktrees without `docs/issues/`, the landing gate's refusal.
2. reconciler on the interface with the ledger; `inflight.ts` reads the ledger.
3. tracker skill references and role prompts.

acceptance: existing `lib/reconcile` and tracker script tests pass, rewritten where they encoded per-branch behavior. Drive on a scratch repository with a vault tree: a spec root with tickets a and b, b blocked by a, and an outside issue blocked by a.
- b starts after a lands in the root's collector; the canonical tracker shows neither done, and a as in flight, until the root lands; then a, b and the root are done and the outside issue is frontier.
- a refine that fails after creating children leaves none behind.
- a worker worktree has no `docs/issues/`, and the tracker CLI run inside it reads the canonical tracker.
