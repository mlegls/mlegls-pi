---
stage: ticket
assignee: agent:technical
author: session:01a12f5a-57a3-74f5-be56-010e18f3b368
part-of: "[[projects/mlegls-pi/issues/reconcile-against-a-global-tracker]]"
priority: 2
---

Make the vault the first implementation of the parent's global `Tracker` contract: one canonical issue directory from every worktree, validated write verbs, and code branches that cannot carry tracker mutations.

## Context and ownership

Read the parent's decisions, CLI contract and committed stubs:
- `lib/tracker.ts`: replace only the factory stub; keep its interface and snapshot DTO.
- `lib/thread/tracker-worktree.ts`: fill `excludeTracker(cwd)` and `assertNoTrackerChanges(cwd, target, source?)`.
- `skills/enabled/all/mlegls/conventions/tracker/scripts/issues.ts`: strict `parseFrontmatter`, `load`, graph validation, `model`, `findIssuesDir`, and the CLI tail. Reuse the YAML AST/parser and graph model, not regex field rewriting or a second parser.
- `lib/thread/git.ts: checkout` already resolves the main worktree from `git worktree list --porcelain -z`. The common dir's parent is not a reliable worktree root.
- `lib/thread/runtime.ts: newThread` creates owning workers before `options.prepare` and setup; `lib/reconcile/reconcile.ts: ensureCollector` is the other worktree-creation path.
- `lib/thread/lifecycle.ts: integrateThread` implements the actual rebase/merge; `lib/dispatch.ts: integrate` wraps it. Tracker append repair actually lives in `lib/thread/append-union.ts` and is invoked by lifecycle.

This ticket owns the backend/CLI, sparse helper, runtime creation, collector exclusion, integration refusal, and append-union removal. Limit edits to `reconcile.ts` to `ensureCollector`'s exclusion call and any necessary call of the shared refusal helper; the next child owns its scheduler and state. Leave `inflight.ts`'s ledger behavior and all instruction Markdown to those children.

## Edit contract

1. Resolve a git project's tracker to `docs/issues/` in the main worktree belonging to its git common dir, whether invoked from a subdirectory, linked worktree, sparse worker, or an issues-directory symlink. Never prefer a branch's physical copy. Use the same resolution for queries, lint, outline, fields/text and every write. In a non-git vault, retain upward discovery as existing script fixtures depend on it. A git project without a canonical vault is not permission to fall back to another worktree; report no supported tracker (GitHub selection is a later issue).
2. Fill `getTracker(cwd, options?)` with a vault adapter sharing the CLI's storage and lifecycle machinery. Snapshot returns the existing schema-v1 lifecycle projection, not legacy rows, and does not cache by code HEAD. Default derived inflight remains on; `{inflight: false}` suppresses only that display overlay, as the current reconciler subprocess does with `TRACKER_NO_INFLIGHT`. Use this checkout's bundled CLI/module, not an installed old `~/.pi` script; honor the existing `TRACKER_CLI` override where a subprocess adapter is used. No active callers may remain on a throwing stub when this ticket is done.
3. Add the parent's exact read/write commands. `fields` preserves extra metadata and returns normalized relation identities; `text` returns the complete issue contract. `create` takes the requested slug, fields and Markdown body; supply immutable new provenance from explicit `author` or `PI_SESSION_ID`, refusing new creation when neither exists. `update` merges only named fields, null deletes a key, omitted body preserves it, and supplied body (even empty) replaces it whole. Body-only updates are valid. Keep YAML key/alias/tag validation, duplicate-slug checks and graph-cycle validation on the candidate state before publication. A rejected write leaves the current tracker untouched.
4. Vault storage converts logical `part-of`/`blocked-by` issue slugs to quoted vault-absolute links and reads them back as slugs; opaque guard entries stay strings. Preserve unrelated fields, immutable existing `author`, body text and archived identities. CLI may accept an already well-formed vault relation as input compatibility, but the library contract is logical slugs. Prevent slug/path traversal.
5. `close` writes a live done result, drops the claim, records the summary/evidence without duplicating them on replay, and clears resolved issue blockers on dependents (not guard strings). Evidence is a repository-relative code artifact locator, not a file to copy into the tracker; it need not yet exist in the canonical checkout when the owner's target is a linked worktree. `remove` is used only for owned provisional children; no archive/migration feature is added.
6. Serialize canonical mutations and their persistence across processes using the existing process-shared/crash-released lock precedent (`lib/reconcile/reconcile.ts: updateState`). Publish validated files atomically; commit only issue paths touched by the write in the canonical checkout, including dependent edits/deletions. Never sweep the index or include another session's staged files. A persistence failure must identify whether the validated working-tree write happened; commits are persistence, not scheduling. Non-git vaults simply publish files.
7. Fill the sparse helper and call it for newly created owning `options.worker` threads and collectors, before prepare/setup. Create these new worktrees with `--no-checkout`; the helper initializes non-cone sparse checkout excluding `/docs/issues/` and materializes all other paths, notably `docs/attachments/`. Existing non-worker/guest thread ownership and setup behavior stays as it is. Sparse absence is an index setting, not a commit deleting tracker files.
8. Fill the refusal helper using source changes from the merge base with the destination; include additions, modifications and deletions anywhere under `docs/issues/`, not only Markdown. Run it before rebasing/merging and after preparation in `integrateThread`, and before the reconciler's conflict probe can send a tracker-edit branch into an ordinary merge-repair loop. Report the forbidden paths and that mutations belong through the tracker. Imported canonical persistence already in the destination is not a worker-authored edit.
9. Delete the `appendUnion` export/implementation and `settleAppends` integration special case. Ordinary merge conflicts retain their existing abort/report behavior. Search for consumers first; don't leave a hidden tracker-union path.

`check` also uses canonical issue state. Preserve its worktree code/evidence link checks: same-project `issues/` links resolve against the canonical tracker, while other docs and `docs/attachments/` resolve against the checked code revision; foreign projects still use the vault. Retarget the existing branch-link fixture accordingly, rather than making code evidence canonical by accident.

## First use

Provide a committed, runnable scratch rehearsal under `docs/attachments/global-vault-tracker-backend/`, with its command and cleanup recipe in an index. Use a short isolated temp git repo, author identity, a canonical vault, and a shell-fixture worker; no models or credentials. Seed an issue, create a linked worker through `newThread`, then run the checkout's CLI from that worker. Use an unrelated staged sentinel in the canonical repo to observe persistence isolation. Try read, create, fields/body update, invalid write, close and provisional remove; then deliberately commit a forbidden tracker edit on a separate scratch branch to observe landing refusal. Cleanup only that fixture's threads/worktrees/processes.

## Stories and acceptance

- A worker has no physical `docs/issues/`, but CLI/library reads from inside it show the same canonical issue state as the main worktree, including a later write without a code-HEAD change.
- A maintainer can write issue fields or replace its body from a linked worktree; valid writes appear immediately in the canonical tracker, rejected writes leave it unchanged, and unrelated staged work is not committed.
- A code/evidence branch can integrate; a branch that changes `docs/issues/` is refused before touching the destination.
- Existing tracker script, affected thread and landing tests pass after their per-branch assumptions are retargeted. Relevant commands: `bun test skills/enabled/all/mlegls/conventions/tracker/scripts`, `bun test lib/thread/runtime.test.ts lib/thread/lifecycle.test.ts lib/reconcile/landing.test.ts`, and `bunx tsc --noEmit`. Existing fixture-only contract text must gain valid frontmatter if it now travels through the strict tracker; preserve its fresh-before-setup and predecessor-code properties. The next child owns `lib/reconcile/refresh.test.ts`'s global-contract rewrite.

No new retained tests are authorized; the scratch rehearsal is first-use setup/evidence, not another assertion suite. Name changed assertions in the result. Instruction deployment and the end-to-end sibling ledger story belong to the following children and parent join.
