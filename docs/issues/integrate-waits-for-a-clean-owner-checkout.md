---
stage: idea
assignee: agent
author: "session:01a0eb02-2b0d-72c2-ae72-afd97ec8f7dd"
---

`ab supervise` integrate ends in an ff-only merge into the owner checkout, and that merge fails when the checkout has uncommitted edits to paths the branch touches. In Concept on 2026-09-29, another session had uncommitted Playgrounds→Materials edits to `packages/web/src/ui/locale-en.ts` and `locale-zh-CN.ts` in the main checkout. `return-to-the-entry-address-after-sign-in`'s merge refused ("local changes would be overwritten"), after its ~4 minute `bun run check && bun test`. The session writing those edits had been told to wait until nothing was "in flight" before committing, which would never happen: the integrate could not finish while the tree stayed dirty. The supervisor broke the deadlock by mail.

Committed changes on the owner branch fail the same way. Three ffs of `prepare-dependencies-without-starting-local-convex` were lost to docs-only tracker commits (`docs/issues/**`) that landed during its check window.

Possible directions (not decided):
- Before the check, and again before the merge, integrate names the dirty owner paths that overlap the branch and waits for them (or mails their writer, if a session claims the worktree), instead of failing after the check.
- When the ff fails because the owner moved, integrate rebases again. If the new owner commits touch only paths the check does not read (configured per project, e.g. `docs/issues/**`), it fast-forwards without re-running the check.

Related: [[projects/mlegls-pi/issues/archive/close-a-supervised-ticket-inside-its-branch]] accepts "an outside commit may cause a surfaced fast-forward failure" as a limit; [[projects/mlegls-pi/issues/archive/supervise-worktrees-start-without-project-setup]] covers the reinstall after a lockfile-changing rebase.
