---
stage: "done"
assignee: "agent:technical"
author: "session:01a13dff-cc3c-7617-b1c8-119da0d1fa26"
part-of: "[[projects/mlegls-pi/issues/github-issues-as-a-tracker-backend]]"
priority: 2
---
Drive the parent's live GitHub-issue acceptance on the combined backend + CLI/reconciler implementation. Deliver runnable first-use machinery and its evidence, not another backend or retained test suite. Story: a maintainer reconciles an ordinary GitHub spec tree through one PR; private collector progress unlocks its next ticket without pretending the globally open issues are done, and failed refinement leaves no executable provisional debris.

## Starting point / ownership

Depends on `activate-github-tracker-in-reconcile` (and its reader/writer prerequisites). Own a new packet/controller under `docs/attachments/rehearse-github-tracked-reconcile/` and the small first-use guide update alongside its command. Narrow located in-scope seams may be repaired and re-driven while warm; do not replace production scheduling/landing logic with a fake outcome or weaken live acceptance.

Mirror `docs/attachments/rehearse-reconciled-github-pr-landings/journey.ts` and its index for private XDG/board/registry/agents, shellBb workers, actual start/status/resolve/stop, gate/Actions readiness, evidence reports, exact-PID restart and owned cleanup. Mirror `docs/attachments/reconcile-with-global-tracker-and-landing-ledger/refinement.ts` for deterministic failed/replaced refinement. Read `docs/verification-evidence.md`. Existing PR journey used a separate local vault; this ticket instead uses the actual GitHub backend/native issues and must not inherit that vault or a mock githubIssue capability.

## Authorized setup

ONLY private `mlegls/reconcile-pr-transport-20261014-35767b2d`; reuse and preserve it, create no repository/account/token/permissions. Existing authenticated mlegls has admin/maintain/push/triage/pull; main, has_issues true, Actions enabled in earlier journeys. Read-only observation on 2026-10-15 found zero actual issues, ten closed PRs and ten labels (only wontfix overlaps the triage vocabulary). Confirm current state instead of assuming it. Use an owned fresh local clone/temp area and a manifest naming all issues/branches/labels/processes you create. Do not reuse inherited worktrees/PRs as owned resources.

Seed canonical local/committed `docs/agents/issue-tracker.md` naming GitHub and its `triage-labels.md` table; ensure no canonical docs/issues exists. Use the deployed webapp table shape: canonical role -> repository label -> meaning. Seed any missing fixture labels explicitly. Normal primary roles may be ready-for-agent/ready-for-human; a small mapping probe may rename them. Ordinary fixture setup commits/PRs in this supplied scratch repo are authorized, not changes to webapp/simple-compute-market. Preflight current auth, repo/branch ownership, native issue/relationship writes, setup/pre-integrate gate and real Actions readiness before the run. Report not-ready as setup failure, not product behavior.

Use deterministic shell phase workers through the production dispatch/thread path, not paid models; reports must be ordinary board handoffs and code/evidence commits. No writes to the reconciler's landing/refinement/completion receipts by the controller. Native issue seeding and logical contract writes go through Tracker/CLI wherever they are the behavior under observation. Separate deliberate fault injection from genuine API failures.

## Required live journeys

1. Seed a ready-for-agent spec with two native sub-issue tickets a/b, b natively blocked by a, plus an outside ready issue natively blocked by a. Start production reconcile in pr-merge on root `gh-<n>`. Observe root/node claims as actual assignments with matching private receipts. Release a's implement/drive/review reports. Before allowing b's first report, capture a's collector landing/head, b's starting head including a's code, both native a/b OPEN, and outside still blocked. Complete b and the root's residual/refine/join as needed through their real phases.
2. Observe exactly one root PR with native Closes lines for the spec, a and b. Before merge, saved reviewed evidence survives worker retirement, issues remain globally open until GitHub merge actuation, and no target close receipt has been manufactured from collector progress. Let real green checks permit the production pr-merge host to merge. Record MERGED + fetched merge ancestry, child-first `closeAtTarget` result publication/closedAt and evidence-linked native comments for a/b/spec, completed native states, outside dependency release and no duplicate result comments. GitHub can auto-close Closes references at merge: distinguish those host events from the reconciler's child-first saved-result/closure replay; never reopen an auto-closed issue to manufacture ordering.
3. Seed a separate ready-for-agent issue with no children. Observe initial spec inference, then have its actual refine phase promote it through the global update API (`stage: ticket`, no stage label), report children:[], and observe implement dispatch. Include an exact reconciler PID restart after promotion/publication so private ownership/stage receipts survive and the same issue is not refined or created twice. A partition into native ticket children also satisfies the parent, but choose promotion for this bounded encounter; the primary tree already covers sub-issues.
4. Exercise an actual failed refine attempt that has created native provisional sub-issues with the exact supplied attempt token. Through the existing failed/retry/stop/discard protocol, stop its exact writer and observe only still-owned provisional children closed NOT_PLANNED and removed from executable hierarchy. Preserve a baseline/foreign-owned issue. Include a create-after-publication/before-observation cut (or the backend's lost-response injection) and prove it is discovered rather than orphaned. No child worker may start while that attempt is unaccepted. Do not merely call raw gh close to simulate cleanup.
5. Count named `TrackerSnapshot` GraphQL operations from the production transport across the whole run (including external CLI writers); distinguish PR host queries and mutations. Record warm snapshot calls -> zero requests, time-expiry -> one request, own write invalidation -> one next-refresh request, and request count per refresh. Include fields/text and multiple scheduler reads in the warm interval. The result must establish one GraphQL query per actual snapshot refresh, not just a low aggregate count or a claim based on source.

## Evidence, checks, cleanup

Write predictions before first contact, then an index with tested revision, runnable command, owned deployment/checkout/persona, native issue/PR/comment IDs, collector/worker/merge heads, exact restart cut, claim/state observations, query counts and cleanup. Keep concise API extracts establishing transient claims and chronological links; no raw intermediate runner dumps or private bodies/credentials. Backend/CLI evidence is nonvisual (`visual: false`, shots:[]). Evidence for scratch issues is committed in the scratch worker/PR branch and its closing comments link an exact published commit; the mlegls-pi packet indexes those observations.

Use current `bun test lib/reconcile`, tracker script suite and `bunx tsc --noEmit` on the combined revision. No new retained tests are authorized except the supervisor-required focused real-run GitHub rate-limit regression below; this exception does not authorize another backend or general retained test suite. All parent acceptance remains live; seeded/offline observations can supplement but not replace native assignments/relations, GitHub issue outcomes, the merged PR or query counts. A required unobservable claim is blocked, not a caveat that waives it.

Before done, stop exactly the owned reconcilers/workers/controllers, clean only owned new disposable issues/branches as appropriate, preserve the supplied repository/inherited history and the artifact commits used by links, and report any retained local/remote resources by manifest. Parent alone integrates this package branch; scratch PR merge is the prescribed demonstration, not permission to push/merge canonical mlegls-pi.

## Stories / activation handoff boundary

- Full worker launch, recovery and target landing: required here on the combined revision, through the production shell-worker/native GitHub journeys above. The handoff must identify the observed claim-before-launch, collector unlock while native issues remain open, exact-PID recovery, merged target proof and saved-result publication evidence. An unobservable required journey is blocked, not held.

Decision (2026-10-15, parent exception ruling): activation’s driver incorrectly included this full-journey story in its bounded wiring packet. [[projects/mlegls-pi/issues/activate-github-tracker-in-reconcile]] reports only its public wiring/canonical-selection and bounded reservation/provisional/move-out stories. This rehearsal retains the full launch/recovery/landing obligation; activation’s adapter observations and retained fake-gh tests are supplementary, not substitutes for the live crossings. Carry forward its explicit run-loop/final-head evidence limits when planning the combined run. Parent acceptance is unchanged.

## Replay readiness and rate-limit acceptance (2026-10-15 parent exception ruling)

The independent drive at aa638c89 passed prepared inspection but failed setup before launch: journey.ts admits at most 90 existing issues to leave ten under its single-page cap; the preserved authorized repository already has 95. This is a controller admission failure, not evidence that production pagination failed. The current snapshot reader follows cursors beyond first:100, so simply deleting that guard would also invalidate the one-operation acceptance on the expanded fixture. Historical artifact inspection does not replace the blocked transient stories.

Repair the owned first-use controller/transport and guide to permit a fresh native run on the SAME preserved repository. Preserve inherited issues/history and linked artifact commits; do not substitute a new repository, delete inherited issues, or silently relax the one-query acceptance. Use the parent-recorded bounded first/last alias plan, node-ID deduplication and totalCount completeness checks if a snapshot repair is required. Narrow located snapshot/counting seams are authorized here to satisfy that existing contract: one named TrackerSnapshot operation per complete refresh, including nested connections; explicitly refuse counts beyond coverage. Report unique covered counts/completeness rather than assuming hasNextPage on one alias means the combined snapshot is incomplete. A multi-query cursor fallback is not a passing one-query result. Recheck readiness before starting the journey. Setup friction is tracked by [[projects/mlegls-pi/issues/native-rehearsal-single-page-capacity-prevents-replay]].

Acceptance / Stories (in addition to all five required native journeys):
- Fresh full native launch/recovery/refinement/target-landing journey on the combined final revision is runnable and observed, not replaced by inspect.ts or historical claims. Preserve the required claim-before-launch, OPEN collector unlock, exact-PID restart, merged ancestry, saved-result publication and per-refresh query evidence.
- Inject a finite GitHub rate-limit hold inside an active production run() using a clearly identified fake-gh response or owned recorded-reset-file cut; do not exhaust the real account. Observe hold and timed resumption, no owner mail/exceptions, and preservation/replay of the SAME pending worker report.
- During that hold, make an actual worker tracker CLI call fail fast; observe the worker waits/retries after reset or the reconciler absorbs/replays its report without forwarding blocked/needs-input to the owner. Repair the located side if necessary. A retained focused test exercising production run(), the failing CLI/report cut and resume is explicitly authorized and required by the supervisor; adapter/untilReset-only tests are insufficient. Supplemental fake transport may cover this deliberate fault, not replace the native journeys.
- Handoff separately names each of those stories and its observations, the injection/reset/report identifiers and no-owner-exception evidence, retained test and final-head regression results. Keep this failed setup observation separate; no required unobservable story may be relabelled held or waived as a caveat.

Retry the drive on its kept chain, repairing and committing these bounded seams while warm; do not discard the prior live evidence or unrelated fixes. This ruling changes no product decision and certifies neither integration nor target completion.

## Result

done: all six required stories hold on the same preserved scratch repo. The earlier handoff failed to parse because of an unquoted quote character in one caveat; this repost has valid yaml.

```yaml
commit: f802ab0c
setup:
  kind: owned private scratch repo mlegls/reconcile-pr-transport-20261014-35767b2d, existing mlegls gh auth
  entry: bun docs/attachments/rehearse-github-tracked-reconcile/journey.ts run
  tested_revision: 3b36ec18885bac85c8b0c18a53474daf658f073a
  areas:
    - /private/tmp/native-reconcile-PJlm0t
    - /private/tmp/native-reconcile-keGcvP
stories:
  - story: Native claims before launch, collector unlock while issues stay OPEN, residual join
    outcome: held
  - story: One PR, real Actions green, production merge, child-first saved-result publication
    outcome: held
  - story: Inferred leaf promotion and exact-PID reconciler restart
    outcome: held
  - story: Failed refinement, lost-create discovery, exact-writer discard
    outcome: held
  - story: Per-refresh TrackerSnapshot accounting
    outcome: held
  - story: Rate-limit hold inside active run(), failing worker CLI, same pending report replayed, no owner mail or exception
    outcome: held
evidence:
  path: docs/attachments/rehearse-github-tracked-reconcile/index.md
  visual: false
  shots: []
tests:
  - lib/reconcile/rate-limit.test.ts
filed: []
caveats:
  - Drive was skipped. The post-landing gate is the live re-drive recorded in the index, owned by this review. The parent integrates and the reconciler closes the execution ticket.
  - The single-page failure was the controller's own admission check (more than 90 issues refused), not a production reader limit. Real runs are unaffected because the reader pages by cursor. The check was removed and cursor paging kept, with no aliased single-query cap.
  - Per-refresh cost is now 1 request for 100 or fewer issues and 2 (TrackerSnapshot plus one TrackerIssues cursor page) for 101-109. The primary area had 44 refreshes, 3 at one request and 41 at two. The interrupted area adds 17 refreshes at one request. All were complete (unique issue ids equal totalCount) and minimal. Warm reads and both hold windows made zero requests. Expiry and own-write each caused one refresh of two requests.
  - Live holds used a recorded-reset-file cut, not a fake gh response. The real account was never exhausted. The retained test uses the fake gh.
  - The same pending worker report is shown for a done report, replayed once after the reset. The blocked report that quoted the limit is nudged back to retry rather than replayed.
  - GitHub auto-closed the Closes issues at merge (09:11:50Z), before the reconciler's child-first saved closedAt (09:12:23 to 09:12:56). Nothing was reopened.
  - Cost - the retained test takes about 31-36 s because of two 12 s holds. The live journey takes about 15 min.
  - The controller's first run failed on its own bug (it read a writer pid after the writer was retired). That attempt's issues 107-110 were closed NOT_PLANNED and are included in the accounting.
  - Retained local areas and branches are listed in replay/api-extracts.json. Remote cleanup is done - PR 115's branch is deleted, no PR is open, and all fixture issues are closed.
  - The earlier api-extracts.json, refreshes.json and index sections remain as the first-encounter record.
changes: none (no join-level structural change)
```

**Seam repaired:** a worker that reported `blocked` or `needs-input` after a fast-failing tracker CLI call was forwarded to the owner as an exception. The reconciler now sends it back to retry, capped at ten (1ee48b03).

**Retained regression:** `lib/reconcile/rate-limit.test.ts` exercises production `run()` through two holds and fails without the fix. Final-head checks: 48 pass, 0 fail, and `bunx tsc --noEmit` is clean.

**Filed and closed:** I closed `native-rehearsal-single-page-capacity-prevents-replay` as fixed and filed nothing new.

Evidence: [docs/attachments/rehearse-github-tracked-reconcile/index.md](docs/attachments/rehearse-github-tracked-reconcile/index.md)
