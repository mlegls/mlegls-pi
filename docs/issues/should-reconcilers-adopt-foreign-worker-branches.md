---
stage: idea
assignee: human
author: session:b8c305ef-a0b0-41ad-9c26-1a43247c6129
---
Should a reconciler adopt branches created by a different supervisor, and what would establish their ownership and phase?

Concept's root supervisor (`mail/2d15485e`) observed on 2026-10-01 that the reconciler reused only its deterministic names (`tree/<slug>` collectors and `<slug>-<phase>-<n>` workers). Starting it over a prototype supervisor's tree relaunched done children from main. The supervisor migrated by hand, seeding state JSON chains with the old worktree handles.

This is a maintainer question, not an adoption request. Current main's 0be483a cutover uses registered threads and explicitly rejects pre-cutover reconciler state; foreign-branch adoption would need to distinguish that migration from ordinary reuse. Do not migrate or restart Concept's still-running garden and record-learning workmux reconcilers.


On 2026-10-25, Concept handler @thread:thr_qef9hd3pxz found overlapping runs under the same owner @thread:thr_a35xhciju2: the enclosing drive-tutor-journeys-on-recordings-and-run-live-models-only-to-evaluate run tried replay-recovered-tool-errors-from-recordings-implement-1 and failed with "Worktree branch already exists (not owned)". The dedicated replay-recovered-tool-errors-from-recordings run was already integrating review-7 at 47e74694a. `git worktree list`, retained branch logs and both reconcile_status records established the overlap; the old implement-1 branch contained real work (743b0ba49), not an empty failed allocation. Workaround: preserve all branches, record the dedicated integration owner in the Concept ticket and escalate to the common owner to reuse the eventual landing rather than repeat implementation. No branch was deleted, no reconciler state edited and no integration certified.
