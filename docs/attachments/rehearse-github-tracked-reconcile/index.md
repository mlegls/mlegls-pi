# Native GitHub reconciler rehearsal

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

The fresh mutation command preflights enough room for ten issues within one 100-issue page. The retained target now has 95 issues, so another single-page rehearsal is **setup-not-ready**, not a backend failure; use the read-only prepared entry above. Do not delete inherited issues to make room. Pagination is separately covered by the existing reader regression; this packet's one-query claim is measured on the actual 85–95-issue run, not generalized beyond that size.

The controller owns private XDG/cache/board/registry/agents and uses the existing shellBb fixture around the production dispatch/thread/phase/integration path. Its ordinary board reports carry committed scratch code/evidence. A live shell writer PID is registered and exact-stop-confirmed; BB CLI turn execution is deterministic, not a live paid provider. Every GitHub backend call delegates unchanged, except the explicitly armed successful-create-response loss. No controller writes landing/refinement/completion receipts.

Canonical docs/agents/issue-tracker.md and the three-column triage table were committed to scratch main, with **no docs/issues**. Four missing labels (needs-triage, needs-info, ready-for-agent, ready-for-human) were created explicitly; inherited wontfix and other labels were preserved. Prepared scratch base **9df76e8420538864beb7ffc52e4b6930fbaa216a** passed setup, the original gate criteria with an owned receipt destination, and real Actions job **116315676514**, run **38703063388**.

## Tested revisions and selected evidence

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
