---
stage: "ticket"
assignee: "agent:technical"
author: "session:01a13dff-cc3c-7617-b1c8-119da0d1fa26"
part-of: "[[projects/mlegls-pi/issues/github-issues-as-a-tracker-backend]]"
claimed-by: "reconcile:github-issues-as-a-tracker-backend"
priority: 2
blocked-by:
  - "[[projects/mlegls-pi/issues/activate-github-tracker-in-reconcile]]"
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

Use current `bun test lib/reconcile`, tracker script suite and `bunx tsc --noEmit` on the combined revision. No new retained tests are authorized. All parent acceptance remains live; seeded/offline observations can supplement but not replace native assignments/relations, GitHub issue outcomes, the merged PR or query counts. A required unobservable claim is blocked, not a caveat that waives it.

Before done, stop exactly the owned reconcilers/workers/controllers, clean only owned new disposable issues/branches as appropriate, preserve the supplied repository/inherited history and the artifact commits used by links, and report any retained local/remote resources by manifest. Parent alone integrates this package branch; scratch PR merge is the prescribed demonstration, not permission to push/merge canonical mlegls-pi.

## Stories / activation handoff boundary

- Full worker launch, recovery and target landing: required here on the combined revision, through the production shell-worker/native GitHub journeys above. The handoff must identify the observed claim-before-launch, collector unlock while native issues remain open, exact-PID recovery, merged target proof and saved-result publication evidence. An unobservable required journey is blocked, not held.

Decision (2026-10-15, parent exception ruling): activation’s driver incorrectly included this full-journey story in its bounded wiring packet. [[projects/mlegls-pi/issues/activate-github-tracker-in-reconcile]] reports only its public wiring/canonical-selection and bounded reservation/provisional/move-out stories. This rehearsal retains the full launch/recovery/landing obligation; activation’s adapter observations and retained fake-gh tests are supplementary, not substitutes for the live crossings. Carry forward its explicit run-loop/final-head evidence limits when planning the combined run. Parent acceptance is unchanged.
