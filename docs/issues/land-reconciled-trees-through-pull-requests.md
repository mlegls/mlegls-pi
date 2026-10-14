---
stage: spec
assignee: agent
author: session:01a12f4c-1aa6-75fe-9c2b-d81acad80dbd
part-of: "[[projects/mlegls-pi/issues/reconcile-github-tracked-projects]]"
blocked-by: [ "[[projects/mlegls-pi/issues/reconcile-against-a-global-tracker]]" ]
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

holes:
- a PR waiting days outlives reboots: confirm the reconciler's restart path resumes a PR-waiting run from state, or record that it must.

acceptance: on a scratch GitHub repository (or a fork) with a two-ticket tree, `pr-merge` opens one PR, repairs a deliberately failing check, merges, closes both nodes and fast-forwards the owner's checkout; `pr-review` opens the PR, repairs once on a changes-requested review with thread replies, escalates a second, and closes the nodes only after a person merges.
