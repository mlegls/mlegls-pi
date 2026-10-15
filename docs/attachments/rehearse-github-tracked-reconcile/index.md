# Native GitHub reconciler rehearsal

**Current parent join:** [final-revision crossing packet](../github-issues-as-a-tracker-backend/index.md). The supervisor's 2026-10-15 clarification defines one query per refresh as one complete logical snapshot, allowing counted cursor pages within it. The bounded alias detour a5d3b214 is reverted; no connection is capped at 200. The controller now uses the committed CLI pin and checks that every worker's `.wm/launch.env` carries that same revision. The final 9a6ea956 replay passed: **44 complete logical refreshes / 88 cursor-page requests**, PR #137 merged, both active-run rate-limit holds passed, and all owned workers retired. See the linked packet for current observations; sections below preserve earlier rounds.

Independent drive on bc32a67d: [encounter, predictions and blocking setup gap](drive.md). Prepared inspection passed; full replay then failed setup capacity before launch (see the replay below for the repair).

Nonvisual: **visual: false; shots: []**. Live native issues, relations, assignments, Git history, Actions and PR merge; deterministic shell phase reports, not paid models. No local vault or mock githubIssue capability.

## Predictions (written before first live contact, 2026-10-15)

- The authorized private repository, current mlegls authentication and actual Actions checks must be ready before any behavioral observation.
- A canonical, committed GitHub convention with the role → repository label → meaning table selects native issues, without a local vault.
- Native assignment plus private receipts precede worker launch. Collector landing unlocks b with a's code while both issues remain OPEN and an outside dependent remains blocked.
- One PR carries native Closes lines. GitHub may auto-close at merge; saved-result replay remains child-first, evidence-linked, idempotent and target-proven.
- An inferred leaf spec can promote via the public global API, then survive an exact reconciler PID restart without another refine/create.
- A failed attempt's exact writer is stopped; still-owned provisional issues (including an unobserved publication) become NOT_PLANNED and detached. Foreign/baseline identities survive; no provisional child launches.
- A warm complete snapshot, fields/text and scheduler reads make zero TrackerSnapshot requests; expiry and own invalidation each cause one next refresh, with one GraphQL query per complete refresh in this small repository.

## Setup and runnable entry

Only **mlegls/reconcile-pr-transport-20261014-35767b2d** was mutated, with existing **mlegls / ordinary gh authentication**. No repository, account, token or permissions were created. Preflight found **81 inherited closed native issues and ten closed/merged PRs**, not the earlier zero-issue state. Private, main, has_issues, ADMIN/maintain/push/triage/pull and Actions-enabled checks held.

After package setup, this committed entry starts at the **prepared native story**, without any retained worktree/private state:

~~~sh
bun docs/attachments/rehearse-github-tracked-reconcile/inspect.ts
~~~

Opened twice, finally with production scheduling reads: fresh owned HTTPS clone, canonical GitHub selection, public CLI fields gh-96, one root PR MERGED, three exact evidence comments, fetched ancestry, detached NOT_PLANNED provisional issues; **zero remote writes**, clone removed. Its fresh snapshot made **one TrackerSnapshot**; three actual schedulingView(snapshot) reads plus six fields/text reads made **zero further requests**.

Full first-use controller and public controls:

~~~sh
bun docs/attachments/rehearse-github-tracked-reconcile/journey.ts run
bun docs/attachments/rehearse-github-tracked-reconcile/journey.ts status OWNED_DIRECTORY
bun docs/attachments/rehearse-github-tracked-reconcile/journey.ts cleanup OWNED_DIRECTORY
~~~

The first controller refused to start when the repository already held more than 90 issues (it wanted its ten new issues inside one 100-issue page). That guard was removed in the replay below: the production reader pages by cursor inside one logical refresh, and the controller now accounts for requests per refresh instead of assuming one.

The controller owns private XDG/cache/board/registry/agents and uses the existing shellBb fixture around the production dispatch/thread/phase/integration path. Its ordinary board reports carry committed scratch code/evidence. A live shell writer PID is registered and exact-stop-confirmed; BB CLI turn execution is deterministic, not a live paid provider. Every GitHub backend call delegates unchanged, except the explicitly armed successful-create-response loss. No controller writes landing/refinement/completion receipts.

Canonical docs/agents/issue-tracker.md and the three-column triage table were committed to scratch main, with **no docs/issues**. Four missing labels (needs-triage, needs-info, ready-for-agent, ready-for-human) were created explicitly; inherited wontfix and other labels were preserved. Prepared scratch base **9df76e8420538864beb7ffc52e4b6930fbaa216a** passed setup, the original gate criteria with an owned receipt destination, and real Actions job **116315676514**, run **38703063388**.

## Fresh native replay and rate-limit hold (review, 2026-10-15)

Drive was skipped for this ticket (the driver could not repair the controller); this section is the reviewer's live re-drive, the post-landing gate for the ticket. Predictions above were not changed. Nonvisual: **visual: false; shots: []**.

**What failed before, and the repair.** `journey.ts run` stopped at preflight with "ten new native issues would exceed one 100-issue page" because the preserved repository already held 95 issues. That was the controller's own admission assertion, not a production defect: the snapshot reader follows cursors (d22b1051), and no real run is affected by the repository size. The repair (4fb3ff5c) removes the guard and keeps cursor paging; it does not add an aliased single-query cap. Measurements now group requests into logical refreshes (`refreshes.ts`): one `TrackerSnapshot` plus the `TrackerIssues` cursor pages that the same process issues next. A refresh counts as **complete** only when its unique issue node ids equal the connection `totalCount` and the last page reports no next page; it is **minimal** when its requests equal ceil(issues / 100) with nothing issued per issue.

**Tested revision:** journey run at **3b36ec18885bac85c8b0c18a53474daf658f073a** (production seam 1ee48b03 plus the controller). Later commits change only the regression's hold length, the capture/inspect accounting and this evidence. Command: `bun docs/attachments/rehearse-github-tracked-reconcile/journey.ts run`. Persona: existing mlegls gh authentication, private **mlegls/reconcile-pr-transport-20261014-35767b2d** only. Preflight found 95 inherited issues (all closed), eleven PRs, Actions enabled; scratch base **1bd22233…** passed setup, the gate and real Actions job 116339072646. Owned area **/private/tmp/native-reconcile-PJlm0t**; the single interrupted attempt **/private/tmp/native-reconcile-keGcvP** (controller read a retired writer's pid after the hold stories had passed; its seeded #107–#110 were closed NOT_PLANNED by the failure path, never reopened, never merged) is included in the transport accounting but not in the story evidence.

Selected extracts are in [replay/api-extracts.json](replay/api-extracts.json); every refresh is listed in [replay/refreshes.json](replay/refreshes.json).

| Story | Outcome | What established it |
| --- | --- | --- |
| 1. Native claims, collector unlock, residual join | held | Native spec **#111**, tickets **#112 (a)** / **#113 (b)**, outside **#114** (b and #114 natively blocked by a). `claimsBeforeLaunch`: for all nine primary workers the native issue was OPEN, assigned to mlegls and had the matching private receipt `reconcile:gh-111` *before* the BB spawn. a's collector landing **428c1912038db8cbbb0f640d5f4f0f942a214daa** (09:07:10Z) was b's starting head; #112/#113 still OPEN, #114 still blocked, **0** target close receipts. |
| 2. One PR, real merge, saved-result publication | held | One PR [#115](https://github.com/mlegls/reconcile-pr-transport-20261014-35767b2d/pull/115) with exactly Closes #112/#113/#111; at publication all OPEN, workers retired. Real Actions (runs 38710978995, 38710987805) passed; the production pr-merge host merged at 09:11:48Z (**c4b4218926eb63867c03b3ec560443ab8683a536**, head 52cee6e7…, fetched ancestry true, owner ff `updated`). GitHub auto-closed #111–#113 at 09:11:50–51Z (host clock); the reconciler's child-first saved closedAt came later: a 09:12:23, b 09:12:38, spec 09:12:56 with exactly one evidence-linked result comment each ([#112](https://github.com/mlegls/reconcile-pr-transport-20261014-35767b2d/issues/112#issuecomment-6188616146), [#113](https://github.com/mlegls/reconcile-pr-transport-20261014-35767b2d/issues/113#issuecomment-6188622971), [#111](https://github.com/mlegls/reconcile-pr-transport-20261014-35767b2d/issues/111#issuecomment-6188627826)), all COMPLETED, #114 became frontier. No auto-closed issue was reopened. |
| 3. Promotion and exact-PID restart | held | Ordinary ready-for-agent **#116**, inferred spec; its refine worker `gh-116-refine-1` (thread d211a256…) promoted it through the global API (stage ticket, no stage label), reported `children: []`, acceptance recorded, `gh-116-implement-2` dispatched. Reconciler pid **66048** SIGKILLed after that; restart pid **68074**; six seconds later the same implement handle, counter still 2, one refine, no regenerated child. |
| 4. Failed refinement, lost publication, exact discard | held | Ready spec **#117** (baseline **#118** completed). Writer `gh-117-refine-1` (live pid **72837**, thread 4ccc0619…) used token `reconcile:gh-117/gh-117-refine-1`; provisional **#119** observed; reconciler pid **71048** killed with the writer alive; the CLI created **#120** while it was away and the proxy deliberately dropped the successful create response (fault injection, not an API failure). Saved `owned` lacked #120 at the cut; on restart production discovered it. The writer's ordinary blocked report triggered production discard: writer stopped first, **#119 and #120 closed NOT_PLANNED, detached, unassigned**; baseline #118 COMPLETED and foreign human-ready **#121** preserved at that point; zero provisional implement launches. |
| 5. Query accounting | held | See below. |
| Rate-limit hold inside an active run() | held | See below. |

### Per-refresh query accounting (story 5)

The proxy counted named operations at the real gh transport for every process, including external CLI writers and cleanup. Primary area: **44 logical snapshot refreshes, 85 tracker read requests** (44 `TrackerSnapshot` + 41 `TrackerIssues` cursor pages), plus 10 `TrackerCreate`, 21 `TrackerWrite`, 21 PR-host GraphQL queries and 122 REST commands counted separately. Requests per refresh: **1 for 3 refreshes (≤100 issues: 99–100), 2 for 41 (101–109 issues)**; all 44 complete (unique node ids = totalCount) and minimal; no continuation was unattributed. The interrupted area adds 17 refreshes of one request each (99 issues). Because the repository now exceeds one page, **the per-refresh figure is two requests, not one**; the parent contract is one logical snapshot per refresh with cursor paging inside it, and no refresh reads an issue twice or pages per issue.

- 24 warm snapshot/fields/text/CLI reads → **0 requests**.
- Real 61 s wait → **1 refresh = 2 requests** (103 issues covered, complete).
- A public CLI write invalidated the cache → **1 refresh = 2 requests** on the next read.
- Production worker active for 11 s with twelve more public reads and the five-second scheduler loop → **0 requests**.
- During both rate-limit holds → **0 gh requests** of any kind (transport log between hold detection and reset).

### Rate-limit hold inside an active production run() (supervisor requirement)

Injection: the **recorded-reset-file cut** — the controller writes `rate-limit.json` (the file every gh-calling process consults before calling gh) with a reset 30 s ahead and drops the snapshot cache, exactly the state a GitHub limit leaves. The real account is not exhausted and no gh call is made while it is in force. While worker `gh-113-implement-4` (thread 0952aa31…) is running:

1. **CLI fails fast, worker gives up** (hold to 09:08:02Z, injected 09:07:31Z). The reconciler logged one `tracker rate limit: holding every node until 09:08:02.000Z`. The worker's real `update` CLI call exited 1 in 355 ms with the typed "GitHub tracker: API rate limit exhausted until …; this is a hold, not a blocker" message (no gh request). The worker reported `blocked` quoting it (board id mv9bfg47-wh0u8s). Reconciler answered at 09:08:09Z, after the reset, with the retry instruction (id mv9bg6xg-sjt7xf) instead of raising an exception; the chain stayed in implement with the same handle, **no owner mail, no exceptions**, and the worker's retry succeeded.
2. **Pending report replayed** (injected 09:08:20Z, reset 09:08:51Z). The worker's done report (id mv9bginw-79ir3i, 09:08:24Z) was unconsumed mid-hold (phase implement, handledTs unchanged, counter 4); after the reset the same report advanced the chain once to `gh-113-drive-5` (launched after the reset, counter 5). One hold note, **no owner mail and no exceptions** across both holds; the hold windows made **0** gh requests.

Located defect fixed here (1ee48b03): a worker that quoted the typed limit as `blocked`/`needs-input` was forwarded to the owner (and a refining one discarded its attempt). The reconciler now sends it back to retry, capped at ten. Retained regression [lib/reconcile/rate-limit.test.ts](../../../lib/reconcile/rate-limit.test.ts) runs production `run()` against the stateful fake gh: it fails without the fix with "exception gh-2: implement blocked → owner".

### Checks, cleanup and retained resources

- `bun test lib/reconcile lib/tracker-github.test.ts skills/enabled/all/mlegls/conventions/tracker/scripts`; `bunx tsc --noEmit`: results in the final report.
- Stopped exactly the owned reconcilers (the two deliberate exact-PID kills, 66048 and 71048, and their restarts); all production workers retired (`liveWorkers: 0`); recorded writer pids stopped by the BB stop path. PR #115's remote branch was deleted; no PR is open; all ten issues the primary area created are closed (#111–#113, #118 COMPLETED; #114, #116, #117, #119–#121 NOT_PLANNED). Retained: the supplied repository and history, merged artifact commits (52cee6e7…, c4b42189…), local areas and ten local phase branches listed in [api-extracts.json](replay/api-extracts.json), and the four triage labels created earlier. The same inventory covers the interrupted area (#107–#110 NOT_PLANNED).
- First-use guide updated: [reconcile-pull-requests.md](../../guide/reconcile-pull-requests.md).

## First encounter: tested revisions and selected evidence (historical)

- Package base: **16b8556bafe61d0ea506f6e3571fc4fa60cabb0f**.
- Tree continuation, promotion and publication: **f6f6d938**, including collector fix **b47ed111**.
- Lost-response discard recovery and target/result re-observation: **01044679**, including reader fix **40118c2b**.
- Final checks include existing-test time-budget repair **75eeec35**; no behavior assertion or test was added/removed.
- [API/protocol extracts and owned resource inventory](api-extracts.json): selected native IDs, before-launch claims, collector/publication/merge observations, exact restart cuts, cleanup. No raw private issue bodies or intermediate runner dumps.
- [Every measured snapshot refresh](refreshes.json): timestamp, actual named operation, transport PID/parent, response issue count, success and pagination flag. [capture.ts](capture.ts) selects these observations from the two owned manifests; it never edits run state.

Successful recovery entry: journey.ts finish-failed /tmp/native-reconcile-OAorNn. The main run used the same owned seed across controller interruptions rather than creating duplicate roots. The fresh inspect command above needs none of those local files.

## 1. Native claims, collector unlock and residual joins — held

Native spec **#96**, tickets **#97 (a), #98 (b)**, outside **#99**. Both tickets have native parent #96; #98 and #99 have native blocked-by #97. Native snapshot edges were asserted after CLI seeding, not body fallbacks.

Before each worker's BB spawn, the proxy captured native OPEN + assignee mlegls + exact matching private receipt. Examples (UTC, from api-extracts):

| Before launch | Node / worker | Thread | Native/private claim |
| --- | --- | --- | --- |
| 08:10:36.603 | #97 / gh-97-implement-2 | de05d49c-650e-4d61-9557-a6511950df93 | mlegls / reconcile:gh-96 |
| 08:14:57.433 | #98 / gh-98-implement-7 | 927ebce8-273b-49ff-b2a6-e37ccc39f19d | mlegls / reconcile:gh-96 |
| 08:16:07.829 | #96 / gh-96-implement-a | 3a59e447-7d07-4154-add2-01c9f10e4afa | mlegls / reconcile:gh-96 |

After a's actual implement → drive → review, collector landing was **a85d04fcadae087bfadc7f2b994bbdce702a7547**, into gh-96. Before b's first report, b started at that exact head, contained fixture/gh-97.txt and proved a ancestry. Native #97/#98 were both OPEN and assigned; #99 remained blocked/frontier:false; **zero closedAt target receipts**. b's reviewed head was **dd651a3e856dfda61ca115b33a701637ddaed34b**. Root residual implement/drive/review carried both children at **2d53966f8fda3c274e4dbc85542d8450b202c58d**.

The live run located a real launch bug: a physical collector checkout path was compared with a logical ledger destination. b47ed111 normalizes only owned collector paths to their issue key before scheduling. The same saved a result and code unlocked b after this repair.

## 2. One PR, real green merge and saved-result publication — held

Exactly one PR for the root branch: [#100](https://github.com/mlegls/reconcile-pr-transport-20261014-35767b2d/pull/100), reconcile/pr/gh-96-0ba9c3408eb4. Its native lines are exactly **Closes #97; Closes #98; Closes #96**. At publication all three issues remained OPEN, all workers had retired, original reviewed packets remained saved, and no result had closedAt.

Jobs **116320691901 / 116320633149** (runs **38704578859 / 38704561348**) were pending at publication, then completed/success on the pushed/reviewed head. The production pr-merge host—not the controller—merged at **08:18:33Z**, commit **8cc5eba402aff351be9bb2d2fb914174221caa1a**. Fetch + merge-base proved reviewed head ancestry; ownerSync=updated.

GitHub auto-closed the Closes references. The following are **different clocks**, not a claim of host child-first close ordering:

| Node | GitHub native closed_at | Reconciler saved closedAt | Native result comment |
| --- | --- | --- | --- |
| a #97 | 08:18:35Z | 08:19:15.710Z | [6187698682](https://github.com/mlegls/reconcile-pr-transport-20261014-35767b2d/issues/97#issuecomment-6187698682), posted 08:19:05Z |
| b #98 | 08:18:36Z | 08:19:28.903Z | [6187703441](https://github.com/mlegls/reconcile-pr-transport-20261014-35767b2d/issues/98#issuecomment-6187703441), posted 08:19:22Z |
| spec #96 | 08:18:35Z | 08:19:47.202Z | [6187707953](https://github.com/mlegls/reconcile-pr-transport-20261014-35767b2d/issues/96#issuecomment-6187707953), posted 08:19:39Z |

All three native states were COMPLETED, each had **exactly one** saved-result marker/comment, and each linked docs/attachments/native-rehearsal/gh-N.md at the exact published commit **2d53966f…**. Original saved packets compared equal after removing only closedAt. Outside #99 became frontier after target completion. Final repaired-reader re-observation and the fresh inspection again found exactly one result comment per node. **No auto-closed issue was reopened.**

## 3. Inferred leaf spec, actual promotion and exact-PID recovery — held

Ordinary ready-for-agent **#101**, initially no children or stage label, inferred **spec**. Its actual gh-101-refine-1 worker (thread **2282cd73-915f-4514-98a9-a9c04e712996**) used the public global update API from its worktree to set stage:ticket, then reported children:[] on the board. Production acceptance recorded phase:accepted, prepared/landed stub head **8cc5eba4…**, then dispatched **gh-101-implement-2**, thread **56910d70-8b80-4bb1-b584-e7737def331a**.

Killed exact reconciler PID **84290** after promotion/acceptance publication and implement dispatch; public start resumed PID **86887**. After another six seconds the same implement handle remained, counter stayed **2**, fields still reported ticket, stable reservation still matched native assignment, and **stageLabels:[]**. One native issue/create, one refine, one implement; no regenerated child or second refinement. Explicit stop then retired its workers; terminal fixture cleanup closed it NOT_PLANNED, not as a delivered code result.

## 4. Failed refinement, lost publication and exact discard — held

Ready spec **#102** had completed baseline **#103**. Actual writer gh-102-refine-1 (thread **da45d75d-7cdc-408b-afe3-31107ea62c3f**, live PID **93061**) received and used exact supplied token **reconcile:gh-102/gh-102-refine-1**.

- Created native provisional **#104** with that token and parent; production observed it.
- Killed only reconciler PID **91148**, leaving the writer alive. Created **#105** through the CLI while that reconciler was absent. The observational proxy deliberately discarded the successful TrackerCreate response at **08:22:42.787Z**; this is fault injection, **not an API failure**.
- Saved pre-cut owned[] lacked #105. On restart, production discovered its native correlation/parent/assignment and added it to owned[]; no re-create request.
- Foreign human-ready **#106** was not attempt-owned; it was preserved (and set aside from executable hierarchy as an idea). Baseline #103 remained COMPLETED.
- The ordinary blocked board report triggered production discard. Exact writer stop receipt: **08:23:05.955Z**, before close/detach/release. #104 closed NOT_PLANNED at **08:23:07Z**, #105 at **08:23:16Z**; both detached/unassigned, absent from the private executable snapshot. **Zero provisional implement launches**.
- This exposed an unmaterialized-create replay bug: after successful discard, the old pending create incorrectly demanded its original parent/assignment. 40118c2b honors the already-saved exact removal authority during that progression and ignores finalized removed creates. Fresh production restart PID **15378** recovered phase **removed**, with both owned identities preserved in the receipt; no controller receipt edits or raw-gh simulated discard.
- Baseline #103 and foreign #106 were still present; #106 was still OPEN at that observation. Only later terminal housekeeping closed remaining disposable fixtures.

## 5. Measured production transport/cache behavior — held

The proxy counted **named operations at the actual gh transport**, including every external CLI writer and cleanup, not source estimates. Main owned run: **58 TrackerSnapshot**, **10 TrackerCreate**, **24 TrackerWrite**, **21 separate PR-host GraphQL observations**, and 166 REST command delegations. Aborted setup/its final cleanup: **14 TrackerSnapshot**, 4 creates, 3 writes and 46 REST delegations. Thus **72 actual snapshot refreshes / 72 snapshot GraphQL requests**, every response complete, success, no next page; max native issue count **95**. Tracker mutations and PR queries are separate categories; REST includes host checks/merge and native relation/cleanup calls and is not miscounted as snapshots.

- 24 warm public snapshot/scoped-snapshot/fields/text/CLI reads → **0 requests**.
- Real 61-second wait (no edited cache/clock) → **1 request** on refresh.
- Public external CLI own write invalidated the cache → **1 request** on the next read.
- Active production worker parked without reports for 11 seconds, with twelve more public reads and the five-second scheduler loop → **0 requests**.
- Final fresh inspection independently called actual schedulingView(snapshot) three times and fields/text six times → **0 warm requests**, one initial refresh.

[refreshes.json](refreshes.json) enumerates every refresh rather than merely giving a low aggregate. The deliberate lost response is separately tagged and only affects TrackerCreate.

## Interruptions, repairs and cleanup

The first owned area **/private/tmp/native-reconcile-XDxk1n** seeded #92–95 and was stopped before a useful report because its inherited gate wrote to an older rehearsal receipt directory. The controller now preserves gate criteria but uses its own receipt path. Those four issues are NOT_PLANNED/unassigned; no PR was created. Four new triage labels are retained.

The primary area **/private/tmp/native-reconcile-OAorNn** had a controller-only missing root-chain timestamp fault, then the located collector launch defect. Cleanup dispositions were deliberately reset **only for these owned NOT_PLANNED, unmerged fixtures**; pending a result/code was preserved. No globally delivered/auto-closed issue was reopened. These interruptions and their transport calls remain included, not hidden as a different success run.

Both areas, their manifests, retained local staging/collector/unmerged phase branches, and all created process/branch/label identities are listed in [api-extracts.json](api-extracts.json). Production stop retired all owned registry workers; exact-PID ps of all 22 recorded reconciler/writer PIDs returned none. Controllers exited or were exact managed-process stopped. PR #100's remote branch was deleted; no owned PR remains open. The supplied repository, inherited history/issues/branches, merged artifact commits, closed evidence issues and four fixture labels are preserved. No browser, server, container, tunnel or paid model was started. Local areas are intentionally retained for inspection, not required by the committed read-only entry.

## Existing checks

- Final combined regression command: bun test lib/reconcile skills/enabled/all/mlegls/conventions/tracker/scripts; bunx tsc --noEmit — **38 pass, 0 fail, 847 assertions; typecheck clean** (3m13s including tsc). Production code is unchanged from 01044679; the packet/inspection entry is cc6178f5 and this check receipt follows it.
- Reader repair: bun test lib/tracker-github.test.ts — **9 pass, 0 fail, 66 assertions**; tsc clean.
- Earlier tracker-only rerun: **24 pass / 681 assertions**; reconciler rerun **14 pass / 166 assertions**, tsc clean.
- Default timeouts intermittently cut the 165-subprocess invalid-input matrix at 30 seconds and the scheduling/legacy checks at five seconds. Standalone reruns established passing assertions. 75eeec35 increases only those existing time budgets (60/30/15 seconds); no assertion, expected value, behavior gate or retained test count changed.
