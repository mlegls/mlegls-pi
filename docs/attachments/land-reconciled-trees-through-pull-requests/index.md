# Reconciled tree → one pull request: combined join

Independent combined-revision [encounter and final replay](independent-drive.md#authorized-fixture-repair-and-final-replay) on fixture revision `daf01ced`: **held**. After supervisor-authorized BB-only fixture adaptation, live PR #10 completed check repair, histories/restart, merge/child-first closure and owner ff; seeded reviews/checks/zero-check and all five staging cases passed. Typecheck passed. Both prepublication and completed cleanup passed. [Global friction](../../../issues/scratch-pr-rehearsal-shell-model-unavailable.md) records the initial setup incompatibility and repaired evidence pending target integration.

Nonvisual CLI/API/Git evidence. Starting revision `e36fc32e`; production join `66a1c218` removes the completed staging lifecycle guard; final runnable-fixture revision `7419f1e0` changes only the one-off staging setup, not production behaviour. The submitted-review selector remains enabled (`prReviewLifecycleReady = true`); its marker-filter regression is retained in `lib/reconcile/pr-reviews.test.ts`. No new retained tests were added at this join.

The root integrates into run-owned staging; collectors remain local. Publication, polling, budgeted merge-only repairs and submitted-review receipts use that same destination. Only observed MERGED plus fetched base ancestry transfers pending results to `github:<repository>:<base>` and closes them child-first. The owner checkout remains a best-effort mirror.

## Setup and entry points

Required live target: the authorized private `mlegls/reconcile-pr-transport-20261014-35767b2d`, ordinary existing `gh` identity with push/Actions access. No new repositories, accounts, tokens or permissions. `mise run setup` completed in this worker checkout. The owned live replay preflight observed login `mlegls`, ADMIN, default `main`, enabled Actions, successful SSH fetch/push, then a green base check before starting workers. Local board/registry/agents/XDG/tracker and shell workers are isolated per invocation; no model calls or production tracker writes.

```sh
bun docs/attachments/rehearse-reconciled-github-pr-landings/journey.ts pr-merge
bun docs/attachments/reconcile-submitted-pr-reviews/probe.ts
bun docs/attachments/reconcile-pr-checks-and-branch-updates/probe.ts
bun docs/attachments/reconcile-pr-checks-and-branch-updates/probe.ts publication-zero
bun docs/attachments/stage-reconciled-root-for-pr-landing/staging.ts all
```

Each command lands directly on its story surface. The first uses real GitHub; the others use explicitly seeded host observations with real Git, gates, shell workers and vault closure, require no credentials, and retire/delete their private resources in `finally`. Bun, Git, mise and GNU parallel must be on PATH. Current fixtures use production BB transport with an isolated fake BB CLI and synchronous deterministic shell spawn actions; no daemon, model or zmx runtime is used. The live command prints OWNED_DIRECTORY; run its documented `cleanup OWNED_DIRECTORY` afterward. Preserve the supplied repository and inherited branches.

[First-use guide](../../guide/reconcile-pull-requests.md) checked against the combined implementation: committed mode defaults, tool/CLI override, mode-preserving restart, URL/status, exception acknowledgement, deployment consequences, merge-only history and clean/base-only owner ff all correspond to the public entry points.

### Approved review boundary

The [2026-10-14 maintainer ruling](../rehearse-reconciled-github-pr-landings/index.md#maintainer-decision--2026-10-14) accepts APPROVED and both CHANGES_REQUESTED boundaries on seeded evidence, combined with live COMMENTED repair, marker replies/restart, and authorized same-account **outside-process** merge. No distinct reviewer was supplied; those review states are not claimed live. The existing [PR #5 encounter](../rehearse-reconciled-github-pr-landings/index.md#authorized-external-merge-and-completion) proves two-ticket review-mode remote completion and zero reconciler merge requests. The join does not change that review/merge policy; its seeded controls were replayed below.

Native GitHub tracker acceptance belongs to the separate backend tree per this ticket's supervisor ruling. This revision supplies `Tracker.githubIssue` capability and opaque-identity publication; it does not include a native issue adapter. Vault completion remains the acceptance target here.

## Current revision encounters

### Submitted reviews — held, seeded host

Entry `reconcile-submitted-pr-reviews/probe.ts`, production `66a1c218`: exit 0, 49 s. Approval without unresolved threads was consumed without a repair or merge; R1 CHANGES_REQUESTED and R2 COMMENTED coalesced to one worker from the contributor head, with T1/T2 replies. A post-before-save reply cut replayed the same marker without duplicate; a review arriving during repair remained available. Later changes-requested produced `Second changes-requested review after repair`, without a second worker or merge. Only the explicit contributor-side merge closed the root.

Selected actual Git/runtime joins: contributor `fc195ecd22cebbad53259dd6d41ee2b487fd05aa`; repair `8e21b41e036dd13d39c2694f330ac323c3cd1271`; pushed head `90202f1f2728495848c9a617f4112657c1629201`; merge `8d8755b2c56be6d44c490acc71535d6b3c99aedf`; worker `root/repair-1`, thread `7a127f5a-5ab6-4497-8a25-c74ff65b9178`. Exactly two posts, one worker, zero host merge calls, five gates; target `github:seeded/lifecycle:main`, stage done. Private resources retired.

### Publication/checks/history controls

Both `reconcile-pr-checks-and-branch-updates/probe.ts` modes exited 0 on `66a1c218` (92 s together). The normal encounter cut PR creation before saving identity, then recovered the same PR (create count one); pending base checks and unavailable transport launched no worker or merge. A failing check launched a real worker; a failed integration gate retried that same worker. Dispatch-before-save and integrate-before-save recovered exact identities/ancestry. Contributor push races and base conflicts preserved both histories, passed exact-head gates and used normal pushes. Two repairs exhausted the shared budget; no third worker. Closed-unmerged held without target close. A seeded MERGED observation plus real remote merge closed at the remote target even with owner unavailable/held (`ownerSync: left`). Eleven gates/four merge hooks; merge `d85e754c14749249f1ebdd486e510d3729f59a65`.

The zero-check publication encounter created one PR, made one guarded merge request immediately (no polling grace), proved merge `083cd32b2b922f5e50fcc775d7084408d2b61df0` carries pushed head `9ed8d3597b106db4114b98b5bc58fd962c8a3805`, closed at `github:seeded/lifecycle:main` and updated the owner. Both fixtures retired/deleted their private resources.

### Owner preservation and bootstrap → lifecycle

The older staging fixture assumed publication was dormant. It now publishes one seeded PR, waits with zero workers, resumes the same identity and still requires actual fetched remote ancestry before close. Its gate now records the staging branch itself when outside a worker; worker ab-parent assertions remain. Four gates are expected (three integrations plus publication), rather than weakening the original worker/gate checks.

The first adaptation exposed the fixture's worker-only `git config --get branch.<branch>.ab-parent` gate: staging has no worker ab-parent, so publication correctly refused and requested a repair. The fixture was corrected, not production gate enforcement. Final `staging.ts all && bun run typecheck` passed on the fixture committed at `7419f1e0` (9 min 3 s). Every encounter published one seeded PR, made nine tree launches/four gates, retired all workers in wait, resumed the same PR/results without replay, refused an unproven MERGED receipt, then proved fetched remote merge and closed a/b/root child-first at `github:seeded/staging:main`. Replaying close made zero additional tracker calls. Committed configuration capture, dirty-config exclusion, explicit conflicting-mode refusal, malformed-config refusal before publication and persisted staging identity recovery still held.

| Owner encounter | Actual fetched merge | Result |
| --- | --- | --- |
| clean | `1bfa699e48db209f32b2cebbf06680ea1bc35c96` | clean/main fast-forwarded; ownerSync updated |
| dirty | `be3d4b6645920ee7697e273bf433b23fa3561563` | HEAD and untracked file preserved; ownerSync left |
| other | `50cce9e2b6db84f7d9ba1cc74f9d7efaeb1c07e5` | HEAD and unrelated branch preserved; ownerSync left |
| divergent | `3854f795ca9725e73023db93017afd770cfd71e6` | HEAD and own commit preserved; ownerSync left |
| missing | `b8ea75a062f56f8bbdab0990d38a15a934af21ab` | absent owner did not prevent close; ownerSync left |

All five private repositories, workers and runtime directories were retired/deleted, including the earlier failed fixture's repair worker. These are seeded-host actual-Git encounters, not live GitHub claims.

### Live two-ticket pr-merge

Owned area `/private/tmp/rehearse-github-pr-34LWsX`, root `rehearsal-merge-34lwsx`. Base readiness: `9f6cc61f5af02472248bf7b550760c2ccf5ede6b`, check `115940483671` completed/success (Actions run `38589559086`). Prediction before contact: collector-local satisfaction keeps outside blocked; one PR through a transport cut and exact-PID restart; failing Actions launches one bounded repair; base conflict/contributor commits survive; green merge closes a/b/root child-first and clean/main owner ff.

Exit 0 in 7 min 11 s on production `66a1c218`; [PR #9](https://github.com/mlegls/reconcile-pr-transport-20261014-35767b2d/pull/9), branch `reconcile/pr/rehearsal-merge-34lwsx-d3f82c5699c6`.

| Action / sensor | Observed result |
| --- | --- |
| Collector → staging | a landed at `02c1964fdcd2786da14dfe210af7598b5c4ca440`; b began from that same head, while a remained globally ticket and outside stayed blocked. Root staged `87710aeb85c6a22b8ea0eb601e09dc531402d4d2`; one OPEN PR, all three results pending, owner unchanged. |
| Transport cut | Injected one GraphQL 502; public owner `answer` acknowledged the actual observation/publication exception, then continued the same #9 rather than opening another. |
| Failing Actions → bounded repair | Checks `115941727552` / `115941659718`, runs `38589914575` / `38589894933`, completed/failure on the staged head. Exact diagnostic was `test "$(cat fixture/ci.txt)" = green`, exit 1. One repair worker `rehearsal-merge-34lwsx-pr-repair-a`, thread `8937fa63-f358-4d90-84a2-fe45aa3fdf33`, changed the located fixture red → green. |
| Base/contributor histories | Separate clone advanced base to `4fc6442e2d3dc17cdc7a6d5f60b95d15b20627b8` (real merge conflict), then pushed contributor commit `081e05d5bf577170a5cd9030106c4efed0743bb6` to the PR. Both are ancestors of the final pushed head; no rebase/force push. Pusher was the approved same login, not a different identity. |
| Exact restart | Killed owned PID `2690`; production start resumed `26477`, preserving #9/mode/branch/review cursors/original results/counter. Exactly nine tree workers plus one repair, no replay. |
| Gates → green → merge | Original root/reviewer and staging gates ran on `87710aeb…`; repair gate on `161a9103e0a6162a198ce3655223e6d1fe244269`; final staging gate and normal pre-push hook on `1158cf17a6899debff0d08112f7f6c9e2bf78eb0`. Checks `115943192269` / `115943178048` (runs `38590334571` / `38590330588`) completed/success on that final head. MERGED at `2026-10-14T15:34:28Z`, two-parent merge `f217e994ca3ae3170fee2cbcc91e13b9ec6158bf`. |
| Remote target → close → owner | Tracker commit subjects exactly close a, b, root; closedAt `15:34:47.709Z`, `15:34:47.899Z`, `15:34:48.084Z`. All stage done; deep comparison excluding only closedAt preserved original result packets. Outside became ready. Clean/main owner ff reached `f217e994…`, ownerSync updated; zero live workers. |
| Cleanup | Documented cleanup exited 0, production stop complete and only this run's remote branch deleted. Owned reconciler PIDs absent. Supplied repository and inherited branches retained. |

The current replay also mapped nonnumeric logical node slugs through the optional tracker capability to `Closes #41`, `Closes #42`, `Closes #43`, `Part of #44`; the actual vault PR omitted closing lines. These are seeded capability observations, not native scratch issue closure.

## Regression checks

`bun test lib/reconcile skills/enabled/all/mlegls/conventions/tracker/scripts && bun run typecheck`: **38 passed, 0 failed, 844 assertions**, 114.78 s tests / 120 s total. This includes the retained marker-only reply filter and existing local-vault/collector/recovery checks. No test assertions were weakened. Typecheck also passed after the final staging-fixture matrix on `7419f1e0`. The only post-check changes are documentation/evidence.

## Cleanup and limits

No browser, deployment, container or tunnel was opened. Seeded fixtures clean their owned resources. Live cleanup completed and the two owned reconciler PIDs are absent; zero live worker registry rows and no remaining process whose command names the owned area. The local scratch directory and supplied repository are retained for parent inspection/disposal; the run's remote branch was deleted. No global execution ticket is closed by this worker.
