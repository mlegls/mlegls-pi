---
stage: ticket
assignee: agent:technical
author: session:01a12f4c-1aa6-75fe-9c2b-d81acad80dbd
part-of: "[[projects/mlegls-pi/issues/reconcile-github-tracked-projects]]"
priority: 2
---
A reconciler can land its tree through one GitHub pull request instead of a local merge into the owner's checkout. Collector landings stay local, and this works with either tracker backend. The `pr` landing comes after `integrate` of the root: push the root branch, open the PR with a [pr](../../skills/enabled/all/mlegls/conventions/tracker/references/pr.md) body (`Closes #…` for every node when the tracker is GitHub), and follow it to merged or closed.

modes, chosen per run, defaulting to the project's committed `.pi/reconcile.json` (`{"land": "local" | "pr-merge" | "pr-review"}`; absent means `local`):
- `local`: today's landing.
- `pr-merge`: the reconciler merges the PR itself once every check reported on it has passed (none reported: at once). Merging may deploy (push-triggered deploy workflows in arkhai-payments and webapp); that is accepted.
- `pr-review`: the reconciler never merges; a person approves and merges.

lifecycle in both PR modes: the reconciler process stays up until the PR is merged or closed, polling it about once a minute. Workers are retired while the PR waits and relaunched on the branch when there is work:
- a failing check: a repair, like a failed integration, within the same budget.
- `main` moved ahead or conflicts: merge the base into the PR branch (no rebase, no force-push), rerun gates, push.
- (`pr-review`) a submitted review that requests changes or leaves unresolved threads, not each single comment: a worker repairs and replies on each thread with what it did. A second changes-requested after a repair is an owner exception.
- commits someone else pushed to the PR branch: continue from them, never overwrite.
- closed unmerged: an owner exception.
- merged: the PR's base is the target, so the nodes close then (done = landed in the target); then fetch and fast-forward the owner's checkout if it is clean and on the base branch, else leave it.

The base branch's checks replace `mainRed` for PR modes.

decisions:
- 2026-10-13: one PR per root tree; collectors stay local (maintainer).
- 2026-10-13: the PR's purpose varies by project: a record and CI where the maintainer owns the project (arkhai-payments, webapp: `pr-merge`), a human review gate elsewhere (simple-compute-market: `pr-review`). None of these repositories enforce reviews or protect the branch, so the reconciler itself must honor `pr-review` (maintainer).
- 2026-10-13: modes chosen at start, default committed in `.pi/reconcile.json` (maintainer).
- 2026-10-13: `pr-merge` gates on every check reported on the PR; a named-check allowlist waits until a slow or flaky check bites (maintainer).
- 2026-10-13: merge commits, so the existing ancestry check (`isAncestor` in prepared-landing recovery) still tells merged from unmerged; squash and rebase merges would need PR-state detection instead (maintainer).
- 2026-10-13: the PR is opened with whatever GitHub identity the harness already uses in that project; a reconciled PR is no different from one a single prompt opens (maintainer).
- 2026-10-13: review repairs trigger on submitted reviews; a second changes-requested is an exception (maintainer).
- 2026-10-13: base updates merge into the PR branch rather than rebasing, to keep review threads anchored; others' pushes are continued from (supplied in grilling, not vetoed).
- 2026-10-13: after merge, fast-forward the owner's checkout only when clean and on the base branch (supplied; confirm).

## Restart contract

Existing `main.ts:start` loads durable state and `extensions/supervision/index.ts:session_start` resumes a missing unfinished run owned by that session; after reboot another session may explicitly call reconcile/start and take ownership. This is not an OS startup daemon. Extend that path to resume opening/waiting/repairing PR receipts with captured mode, branch, PR identity, submitted-review cursors and saved node results. A reboot must not replay the tree or open another PR. The bootstrap, lifecycle and rehearsal children own this previously open hole.

acceptance: on a scratch GitHub repository (or a fork) with a two-ticket tree, `pr-merge` opens one PR, repairs a deliberately failing check, merges, closes both nodes and fast-forwards the owner's checkout; `pr-review` opens the PR, repairs once on a changes-requested review with thread replies, escalates a second, and closes the nodes only after a person merges.


## Execution contracts

Shared stubs committed at `fc7b54b38aceb34c6b69558e1cb0ac85f886392f`: `lib/reconcile/pr-types.ts` (host observations, durable PR/repair/review receipts), `pr-host.ts` (GitHub transport factory), `pull-request.ts` (run hook/context), `pr-reviews.ts` (submitted-review selector), optional GlobalRunState land/pr/target, and optional `Tracker.githubIssue(slug) -> {repository, number, url}`. Vault omits the latter; the GitHub backend supplies it regardless of logical slug spelling. No number-parsing dependency enters state or handles.

A run-owned PR staging branch/worktree is the root's integration destination. Integration follows recorded worker ab-parent, so root and repair workers parent to staging rather than owner. Collectors and internal ledger destinations stay local. Staging carries pending results until fetched remote base ancestry plus the observed MERGED PR proves landing; only then ledger transfers to `github:<owner/name>:<base branch>` and Tracker.close replays child-first. The owner checkout is a best-effort fast-forward mirror, never the PR-mode completion proof. Repository/default base branch are captured at start through the project's ordinary gh/remote context. Published history is merged, never rebased or force-pushed.

Children (serial dependencies, each a one-session literal ticket):
1. [[projects/mlegls-pi/issues/reconcile-github-pr-transport]] — fill host observation/create/find/guarded merge/idempotent thread replies.
2. [[projects/mlegls-pi/issues/stage-reconciled-root-for-pr-landing]] — modes, durable staging destination, run hooks, target close and safe owner ff.
3. [[projects/mlegls-pi/issues/reconcile-pr-checks-and-branch-updates]] — publication, minute polling, CI/base/contributor histories, generic budgeted repair and terminal handling.
4. [[projects/mlegls-pi/issues/reconcile-submitted-pr-reviews]] — submitted review boundaries, reply/progress replay, second changes-requested exception.
5. [[projects/mlegls-pi/issues/rehearse-reconciled-github-pr-landings]] — owned scratch setup, both real GitHub primary journeys, recovery encounters and first-use guide.

All were created atomically with provisional claim `reconcile:land-reconciled-trees-through-pull-requests/land-reconciled-trees-through-pull-requests-refine-1`; no earlier children were adopted. The reconciler converts those claims after accepting the stubs.

## Residual edit contract

After the children land, this issue owns their join, not another implementation of them. Remove remaining stubs/dormant guards, reconcile the host/target/callback/review-progress seams, rerun the kept reconciler/tracker suites together and typecheck. Verify the child rehearsal guide and final packet against the combined revision, re-driving any crossing behavior changed at the join. Commit the combined evidence index under `docs/attachments/land-reconciled-trees-through-pull-requests/`.

2026-10-13 (supervisor): this tree does not wait for [[projects/mlegls-pi/issues/github-issues-as-a-tracker-backend]]. Its acceptance uses the vault tracker; `Closes #…` for GitHub-tracked nodes is accepted under that backend's tree, which uses this PR transport.

First use is an explicitly owned disposable GitHub repository/fork and isolated local board/registry/state, with the harness's existing GitHub identity, push/Actions access, and a distinct authorized reviewer/human merge identity (GitHub prevents self-review). The rehearsal ticket requests missing setup/action rather than faking those live observations. This does not authorize creating accounts/tokens or changing protection/permissions in project repositories.

## Stories and acceptance at the join

Preserve the original primary acceptance above: the two-ticket pr-merge failing-check repair/merge/close/owner-ff journey and the pr-review submitted-review repair/thread replies/second-request exception/human-merge-only close journey. The final packet also establishes one PR through restart, pending collector/staging results and outside blockers, base/contributor-history preservation, no idle workers during wait, closed-unmerged exception, and dirty/other-branch owner preservation. The actual GitHub tracker join establishes the same done-means-target property and native closing references; local vault behavior remains unchanged. Run existing tests (adapt kept setup/assertions only for deliberate new mode behavior), not new retained suites: no new retained tests are authorized by this decomposition. One-off driven fixtures are the explicitly recorded acceptance machinery.
