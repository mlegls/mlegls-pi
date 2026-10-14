---
stage: "ticket"
assignee: "agent:technical"
author: "session:01a13a33-2a17-714d-a4b1-0ff4fb53f8f0"
part-of: "[[projects/mlegls-pi/issues/land-reconciled-trees-through-pull-requests]]"
claimed-by: "reconcile:land-reconciled-trees-through-pull-requests"
priority: 2
---
# Deliverable

Fill `lib/reconcile/pull-request.ts:advancePullRequest` after the mode/bootstrap ticket. One PR per root; keep the reconciler alive while it waits, with no idle workers. This ticket owns publication, CI/base/foreign-push reconciliation, shared repair execution, merged/closed handling. Submitted-review selection is the following ticket's `nextReviewAction` seam.

## Context and ownership

Read the committed `pr-types.ts`, `pull-request.ts`, `pr-host.ts`, `pr-reviews.ts`, `completion.ts`, `checks.ts`, `landing.ts`, `refresh.ts`, and the callbacks wired by `stage-reconciled-root-for-pr-landing`. Existing budget constants are repair=2 and integration=3; s.budget caps live workers. Saved prepared-head receipts, exact worker handles and `Tracker.close` replay are the precedents. Own `pull-request.ts` and private PR/gate/body helpers; change `reconcile.ts` callbacks only as required to fill this interface, not its unrelated scheduler. Do not fill `pr-reviews.ts` here.

## Edit contract

Publication: after root integrate, persist phase opening + prepared head before push/create. Push the staging branch normally, lookup by repository/head branch before create, save PR number/URL. Recover a push/create-before-save by lookup, never open a replacement PR. Body uses a repository PR template when present and the `pr` skill summary/Evidence/Danger form, with the root's saved reviewed summary and each carried node's evidence/result. For a GitHub tracker, obtain each landed node's native number from `Tracker.githubIssue` and append `Closes #n` for root and every carried completed node; append `Part of #n` for an unfinished parent. Assert references belong to the PR's repository. Vault has no closing lines. Never parse numbers out of slugs. Publish the body once from saved results; API failures cannot be mistaken for no checks or a closed PR.

Polling: approximately 60 seconds between remote observations (the normal 5-second run tick may still observe repair workers). Persist lastPolledAt and receipt phases/cursors. PR wait is not a three-hour worker wait. Every restart of opening/waiting/repairing resumes this PR, not the tree. Observe terminal PR state first: CLOSED without merge raises an owner exception; MERGED fetches the base, verifies exact prepared/pushed branch ancestry through the merge commit, and returns merged for the bootstrap/closure callback. Record only observed merged metadata. Never merge in pr-review.

Before work or any push/merge decision, fetch current PR head and base. Continue from all external head commits: fast-forward when possible, merge divergent local/remote histories (no rebase/reset/force-push), and rerun gates after any head/base update. A raced non-fast-forward push refreshes and retries from the newer remote head, never overwrites it. When the fetched base is ahead or PR conflicts, merge base into staging (merge commit, not rebase). Conflict repair workers receive both histories and named files. Clean updates run dependency refresh (`prepareLandingDependencies`), declared pre-integrate gates, carried reviewer tests and supplied packet checks, then push normally. Gates/hook failures use the same repair path. Published history is never rewritten; repair integration uses merge mode and leaves hooks enabled.

A failing check launches a repair worker with check names, exact head and diagnostic URLs/log excerpts; pending checks wait. Share the same bounded repair budget across CI/base/review work; integration retries remain bounded as existing integration. Use the supplied context to launch/report/retire; persist worker request/handle and integration/push/reply milestones, so restart reattaches an exact worker or recovers prepared ancestry instead of duplicating it. Validate the review worker's held stories/evidence before integrating. Persist before retiring. A repair that finds a product choice raises an owner exception instead of expanding scope. Exhaustion raises an owner exception with PR URL/head and diagnostics.

Read checks on fetched base HEAD in place of mainRed for the existing landing hold: pending base checks wait; failing base checks use the existing docs-only/repair exception in checks.ts:heldByRed (fetch diagnostics for failed paths). With a genuine empty set there is no hold. Continue observing terminal state while held, and do not hold a repair against its own failing gate. Auto-merge requires a fresh PR-head observation, no repair/update pending, every reported head check pass (zero: immediately), and a head-guarded merge-commit request. If base/head changes during it, observe again; do not treat merge rejection as success. Base check gating must not silently fall back to the owner's local marker.

In pr-review, invoke `nextReviewAction` only from submitted review observations, and pass its repair request to the same executor. The worker handoff for review repairs contains `threadReplies: {<thread id>: <what changed>}` for every requested thread. After the repair is gated, integrated and pushed, publish each through host.reply with marker `reconcile:<root>:review:<review ids>:thread:<thread id>:head:<pushed oid>`; save per-reply receipts and then update processed/repaired review IDs. A post-before-save crash replays the marker lookup. No thread is silently marked resolved by the reconciler. Keep this path dormant until the review selector is filled.

Expose owner exceptions through the run's existing resolution surface. Retrying an acknowledged exception continues the saved PR and newer observations rather than reopening a PR or rebuilding the tree; pr-review still never merges. Preserve original per-node reviewed results for final close; repair evidence is additional PR/run evidence, not an overwrite of descendants' results.

## First use and acceptance

Use an owned scratch Git remote and an injected typed host to drive `advancePullRequest` from the real run's staging receipt, with isolated shell workers per the ledger rehearsal. Exercise a publication-save cut, a failing head check repaired within budget, remote contributor push before local push, base advancement/conflict, closed-unmerged, and merged while owner is unavailable. Store a runnable one-off probe and observations under `docs/attachments/reconcile-pr-checks-and-branch-updates/`. Distinguish seeded GitHub observations from real git integration, worker retirement and gate runs. Later rehearsal owns the live GitHub two-ticket journey.

Acceptance: one recovered PR identity; no target close before proven merge; all remote head/base commits survive without rewritten history; gates precede pushes; wait holds no worker; pr-merge calls guarded merge only after all reported head checks pass; pr-review never calls merge; errors/closed/unrepairable/exhausted work become owner exceptions while state is resumable. Run existing reconciler/tracker tests and typecheck. No new retained tests are authorized.
