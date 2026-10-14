# PR staging and target closure

Historical bootstrap evidence follows. The fixture now also publishes/waits through the completed lifecycle; see the [combined join replay](../land-reconciled-trees-through-pull-requests/index.md) for current results.

Independent first-use replay at `cd2ee859`: [predictions, observations and replayable checks](drive.md). All five supplied encounters completed successfully.

## Setup and replay

Tested code/setup: `078782f6` (bootstrap `b9dcb99b`). Required environment is an isolated private Git repository, board, registry, agents and XDG state, with shell workers and **no model calls**. The prepared target is disposable `/tmp/rc-pr-staging-*`, owned entirely by each invocation. A local bare remote provides actual fetch/merge ancestry; `seeded/staging` is a seeded host identity, **not live GitHub evidence**. No authentication or secrets are required.

Entry point opened directly:

```sh
bun docs/attachments/stage-reconciled-root-for-pr-landing/staging.ts all
```

Use `clean`, `dirty`, `other`, `divergent` or `missing` for one encounter. Bun, Git, mise, zmx and GNU parallel are on PATH (the repository setup already finished). The script installs ordinary commit/merge hooks, runs setup through the existing worker launcher, observes readiness via registered workers' `shell-started` and tracker snapshots, and retires all private workers/resources in `finally`. It does not disable hooks. No service is handed off resident.

## Encounter

Before publication, the two children integrate into the root collector and remain globally ticket/open; outside's dependency on a remains blocked. The root's implement/drive/review chain is parented to staging. Three real pre-integrate gates run; the root gate records its review worker path, prepared HEAD and staging ab-parent. Root integration transfers every pending result to staging, retires all ordinary workers and collector, and leaves owner HEAD/code unchanged. The receipt and original summaries/evidence survive explicit stop and reload; an opening resume launches no new tree workers.

Mode capture uses committed configuration, ignores dirty configuration, retains the captured mode after a committed config change, rejects a conflicting explicit override, and treats absent saved mode as local. Malformed committed JSON and invalid modes refuse before any worker/state publication. Exact pre-creation identity recovery adopts the persisted staging identity and seed. A local red-main marker does not hold PR root integration.

A seeded MERGED claim without fetched base proof refuses closure. The fixture then makes and pushes a real merge commit to its private bare remote and supplies that OID in a **seeded** MERGED host observation. The resumed reconciler fetches the base, proves ancestry, durably transfers the ledger to `github:seeded/staging:main`, and closes a, b, root child-first with their original results. Replaying completed close receipts makes zero additional close calls. Owner synchronization is a best-effort mirror, not completion proof.

Selected final [receipts](receipts.json) record the actual integration operation, gate paths, thread identity, pending results and fetched merge OIDs.

| Owner encounter | Observed result |
| --- | --- |
| clean | Fast-forwarded from `39ec4a56` to fetched merge `d6e902e1`; ownerSync=updated. |
| dirty | Untracked `uncommitted.txt` and HEAD preserved; ownerSync=left. |
| other branch | Branch `unrelated` and HEAD preserved; ownerSync=left. |
| divergent | Own commit and HEAD preserved; ownerSync=left. |
| missing | Owner worktree removed; target close still completed; ownerSync=left. |

Every encounter made nine phase launches and three integration gates; all workers were archived at staging. Every fetched merge closed `a, b, root` in order; replay made zero additional closes. The clean final root receipt identifies review worker `root-review-9`, thread `57a6f5f6-1eae-42b2-9c07-04da1560da45`, prepared/landed HEAD `7a6336a4`, and staging parent `reconcile/pr/root-41352c6e5a2c`. Twenty normal hooks ran in the clean case. Private repositories were removed after observation.

The first diagnostic run reached successful closure but its commit-subject filter expected `close …` at the start rather than the tracker's prefix. The fixture filter was corrected; the five-case matrix and final clean replay then passed. No retained tests were added or weakened.

Checks: `bunx tsc --noEmit` passed; `bun test lib/reconcile` passed 13 tests; tracker script tests passed 24 tests. Session-start now explicitly passes the saved mode and resolves state through the current repository, including an unavailable owner checkout; typecheck/tracker checks were repeated after that projection/recovery change. This is nonvisual library/CLI evidence; live publication, CI/review repairs and GitHub restart rehearsal belong to the later tickets. `pullRequestLifecycleReady=false` keeps the incomplete lifecycle dormant in this revision.
