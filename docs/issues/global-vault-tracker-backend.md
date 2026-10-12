---
stage: ticket
assignee: agent:technical
author: session:01a12f5a-57a3-74f5-be56-010e18f3b368
part-of: "[[projects/mlegls-pi/issues/reconcile-against-a-global-tracker]]"
priority: 2
---

Make the vault the first implementation of the parent's global `Tracker` contract: one canonical issue directory from every worktree, validated write verbs, and the prepared worktree/landing primitives for code branches that cannot carry tracker mutations.

## Context and ownership

Read the parent's decisions, CLI contract and committed stubs:
- `lib/tracker.ts`: replace only the factory stub; keep its interface and snapshot DTO.
- `lib/thread/tracker-worktree.ts`: fill `excludeTracker(cwd)` and `assertNoTrackerChanges(cwd, target, source?)`.
- `skills/enabled/all/mlegls/conventions/tracker/scripts/issues.ts`: strict `parseFrontmatter`, `load`, graph validation, `model`, `findIssuesDir`, and the CLI tail. Reuse the YAML AST/parser and graph model, not regex field rewriting or a second parser.
- `lib/thread/git.ts: checkout` already resolves the main worktree from `git worktree list --porcelain -z`. The common dir's parent is not a reliable worktree root.
- `lib/thread/runtime.ts: newThread` creates owning workers before `options.prepare` and setup; `lib/reconcile/reconcile.ts: ensureCollector` is the other worktree-creation path.
- `lib/thread/lifecycle.ts: integrateThread` implements the actual rebase/merge; `lib/dispatch.ts: integrate` wraps it. Tracker append repair actually lives in `lib/thread/append-union.ts` and is invoked by lifecycle.

This ticket owns the backend/CLI and the filled sparse/refusal helpers, not their active runtime call sites. The next child activates them together with removal of the reconciler's branch-local reads/close and tracker append repair; otherwise its predecessor would immediately fail against missing issue files or its own forbidden close commit. Leave `runtime.ts`, `lifecycle.ts`, `dispatch.ts`, `reconcile.ts`, `inflight.ts` and instruction Markdown unchanged here.

## Edit contract

1. Resolve a git project's tracker to `docs/issues/` in the main worktree belonging to its git common dir, whether invoked from a subdirectory, linked worktree, sparse worker, or an issues-directory symlink. Never prefer a branch's physical copy. Use the same resolution for queries, lint, outline, fields/text and every write. In a non-git vault, retain upward discovery as existing script fixtures depend on it. A git project without a canonical vault is not permission to fall back to another worktree; report no supported tracker (GitHub selection is a later issue).
2. Fill `getTracker(cwd, options?)` with a vault adapter sharing the CLI's storage and lifecycle machinery. Snapshot returns the existing schema-v1 lifecycle projection, not legacy rows, and does not cache by code HEAD. Default derived inflight remains on; `{inflight: false}` suppresses only that display overlay, as the current reconciler subprocess does with `TRACKER_NO_INFLIGHT`. Use this checkout's bundled CLI/module, not an installed old `~/.pi` script; honor the existing `TRACKER_CLI` override where a subprocess adapter is used. No active callers may remain on a throwing stub when this ticket is done.
3. Add the parent's exact read/write commands. `fields` preserves extra metadata and returns normalized relation identities; `text` returns the complete issue contract. `create` takes the requested slug, fields and Markdown body; supply immutable new provenance from explicit `author` or `PI_SESSION_ID`, refusing new creation when neither exists. `update` merges only named fields, null deletes a key, omitted body preserves it, and supplied body (even empty) replaces it whole. Body-only updates are valid. Keep YAML key/alias/tag validation, duplicate-slug checks and graph-cycle validation on the candidate state before publication. A rejected write leaves the current tracker untouched.
4. Vault storage converts logical `part-of`/`blocked-by` issue slugs to quoted vault-absolute links and reads them back as slugs; opaque guard entries stay strings. Preserve unrelated fields, immutable existing `author`, body text and archived identities. CLI may accept an already well-formed vault relation as input compatibility, but the library contract is logical slugs. Prevent slug/path traversal.
5. `close` writes a live done result, drops the claim, records the summary/evidence without duplicating them on replay, and clears resolved issue blockers on dependents (not guard strings). Evidence is a repository-relative code artifact locator, not a file to copy into the tracker; it need not yet exist in the canonical checkout when the owner's target is a linked worktree. `remove` is used only for owned provisional children; no archive/migration feature is added.
6. Serialize canonical mutations and their persistence across processes using the existing process-shared/crash-released lock precedent (`lib/reconcile/reconcile.ts: updateState`). Publish validated files atomically; commit only issue paths touched by the write in the canonical checkout, including dependent edits/deletions. Never sweep the index or include another session's staged files. A persistence failure must identify whether the validated working-tree write happened; commits are persistence, not scheduling. Non-git vaults simply publish files.
7. Fill the sparse helper for a newly added `--no-checkout` worktree: initialize non-cone sparse checkout excluding `/docs/issues/` and materialize all other paths, notably `docs/attachments/`. Sparse absence is an index setting, not a commit deleting tracker files. Its later caller runs it before prepare/setup on owning worker threads and collectors; this ticket exercises it explicitly in the scratch fixture but adds no production calls.
8. Fill the refusal helper using source changes from the merge base with the destination; include additions, modifications and deletions anywhere under `docs/issues/`, not only Markdown. Report the forbidden paths and that mutations belong through the tracker. Imported canonical persistence already in the destination is not a worker-authored edit. It must be usable before any rebase/probe and again after preparation; production activation and append-union removal are explicitly in the next ticket.

`check` also uses canonical issue state. Preserve its worktree code/evidence link checks: same-project `issues/` links resolve against the canonical tracker, while other docs and `docs/attachments/` resolve against the checked code revision; foreign projects still use the vault. Retarget the existing branch-link fixture accordingly, rather than making code evidence canonical by accident.

## First use

Provide a committed, runnable scratch rehearsal under `docs/attachments/global-vault-tracker-backend/`, with its command and cleanup recipe in an index. Use a short isolated temp git repo, author identity, a canonical vault, and a shell-fixture worker; no models or credentials. Seed an issue, add a linked scratch worktree with `--no-checkout`, invoke the exclusion helper, then run the checkout's CLI from that sparse worktree. Use an unrelated staged sentinel in the canonical repo to observe persistence isolation. Try read, create, fields/body update, invalid write, close and provisional remove; then deliberately commit a forbidden tracker edit on a separate scratch branch to observe the refusal helper before any integration. The next child tests the connected runtime gate. Cleanup only that fixture's threads/worktrees/processes.

## Stories and acceptance

- A worktree prepared by the sparse helper has no physical `docs/issues/`, but CLI/library reads from inside it show the same canonical issue state as the main worktree, including a later write without a code-HEAD change.
- A maintainer can write issue fields or replace its body from a linked worktree; valid writes appear immediately in the canonical tracker, rejected writes leave it unchanged, and unrelated staged work is not committed.
- The refusal helper accepts a code/evidence branch and rejects one that changes `docs/issues/`, without touching the destination. Its production integration story belongs to the next child.
- Existing tracker script, affected thread and landing tests pass after their per-branch assumptions are retargeted. Relevant commands: `bun test skills/enabled/all/mlegls/conventions/tracker/scripts`, `bun test lib/thread/runtime.test.ts lib/thread/lifecycle.test.ts lib/reconcile/landing.test.ts`, and `bunx tsc --noEmit`. Do not weaken the current branch-runtime assertions here: those callers remain unchanged until the next child. If a fixture now invokes the strict backend directly, give its contract valid frontmatter. The next child owns `lib/reconcile/refresh.test.ts`'s global-contract rewrite.

No new retained tests are authorized; the scratch rehearsal is first-use setup/evidence, not another assertion suite. Name changed assertions in the result. Instruction deployment and the end-to-end sibling ledger story belong to the following children and parent join.
