---
stage: done
author: session:2026-09-26T09-29-46-063Z_01a0dd0c-9b4f-7795-aad1-0299963801cf
---

A September 25 Concept worker reports that `issues.ts check` resolved vault-absolute links through the canonical checkout, rewrote its branch's archive links back to live paths, and could not see new branch-local attachments. A worktree-local TRACKER_VAULT mapping avoided those fixes. A September 23 coordinator reports reverting 48 unrelated link rewrites before cherry-picking.

Resolved: `check` is read-only and reports available repairs; `check --fix` explicitly applies archive-link and heading repairs. Same-project vault links use the checked worktree's docs, identified by Git common directory plus repository-relative docs path. Cross-project links still use the vault, including sibling projects in one repository; missing branch-local files never fall back to canonical copies. No custom TRACKER_VAULT mapping is needed for a normal linked worktree.

Verification: 17 tracker CLI tests pass. The new real Git worktree fixture covers divergent archive paths, branch-only attachments and headings, deleted local targets, a sibling project and an unmapped foreign namespace. Existing archive and heading tests now assert read-only checks before explicit repairs. Running `check` in mlegls-pi left all docs Markdown hashes unchanged; existing diagnostics remain, with no bulk repair applied.

[Session evidence and dispositions](../research/session-friction-review-2026-09-26.md).
