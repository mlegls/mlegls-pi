---
stage: idea
assignee: human
author: session:b8c305ef-a0b0-41ad-9c26-1a43247c6129
---

Should a reconciler adopt branches created by a different supervisor, and what would establish their ownership and phase?

Concept's root supervisor (`mail/2d15485e`) observed on 2026-10-01 that the reconciler reused only its deterministic names (`tree/<slug>` collectors and `<slug>-<phase>-<n>` workers). Starting it over a prototype supervisor's tree relaunched done children from main. The supervisor migrated by hand, seeding state JSON chains with the old worktree handles.

This is a maintainer question, not an adoption request. Current main's 0be483a cutover uses registered threads and explicitly rejects pre-cutover reconciler state; foreign-branch adoption would need to distinguish that migration from ordinary reuse. Do not migrate or restart Concept's still-running garden and record-learning workmux reconcilers.
