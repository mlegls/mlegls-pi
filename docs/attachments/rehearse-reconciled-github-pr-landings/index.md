# Owned live GitHub PR landing rehearsal

Independent verification on a2e9b1b: [first-user encounter](independent-drive.md) reached PR #6 but its repeat stopped on transport 502/404. The review that follows it ([cause and repeat](independent-drive.md#review-cause-of-the-404-and-the-repeat)) located the 404 in the journey controller, fixed it and the fixed acknowledgement note, and repeated pr-merge to completion on PR #8 after an injected transport exception: see [Repeat after a transport interruption](#repeat-after-a-transport-interruption). Other observations below remain historical evidence.

Nonvisual CLI/API/Git evidence. Production host/start/run/state/dispatch/integration/gates/retirement/closure; deterministic shell phase workers, not paid models. No ledger writes by the controller. Git hooks stayed enabled. Both landing modes are complete under the maintainer-approved live/seeded boundary recorded below.

## Setup and repeat

Authorization: supervisor supplied only private `mlegls/reconcile-pr-transport-20261014-35767b2d`; preserve that repo and its inherited branches. `gh api user` returned `mlegls`, repo permission ADMIN, default `main`, Actions enabled. SSH clone/fetch/push succeeded. No credentials were copied or printed. The maintainer chose not to supply a distinct reviewer (dated acceptance reduction below). A contributor push uses a separate clone as `mlegls`, explicitly approved by the supervisor; it is not evidence of a second GitHub identity.

Code under test: initial implementation base `d1d17ed4`; repaired production host `c8f19000`; initial controller `785e00e6`; live external-merge observation and final seeded review replay `1883a713`. Final documentation-only revision is the commit containing this packet.

```sh
bun docs/attachments/rehearse-reconciled-github-pr-landings/journey.ts pr-merge
bun docs/attachments/rehearse-reconciled-github-pr-landings/journey.ts pr-review
# Commands print OWNED_DIRECTORY. Local board/registry/agents/XDG/zmx/tracker are private there.
bun docs/attachments/rehearse-reconciled-github-pr-landings/journey.ts status OWNED_DIRECTORY
bun docs/attachments/rehearse-reconciled-github-pr-landings/journey.ts resume OWNED_DIRECTORY
bun docs/attachments/rehearse-reconciled-github-pr-landings/journey.ts ack OWNED_DIRECTORY
bun docs/attachments/rehearse-reconciled-github-pr-landings/journey.ts cleanup OWNED_DIRECTORY
```

Fresh commands append ordinary setup commits to scratch `main`, then wait for real green Actions before starting the reconciler. The global vault lives on a separate local tracker branch; the owner is clean on `main`. Both use a spec root with two tickets (b blocked by a) and an outside dependent blocked by a. `mise run setup` and `mise run pre-integrate` are committed in scratch; the local gate records exact Git heads and checks fixture presence/conflict markers. Actions independently requires `fixture/ci.txt = green`. Shell workers commit ordinary evidence and publish structured reports on their ordinary worker board topics; the controller releases phase reports and repairs only the located fixtures.

Automated: setup, tree phases, CI repair, base/contributor histories, restart, close observation, COMMENTED submitted-review repair/replies. External control: the operator performs the authorized merge outside the reconciler.

### Maintainer decision — 2026-10-14

[Recorded through the global tracker](../../../docs/issues/rehearse-reconciled-github-pr-landings.md), from board decision mv884mdq-xoy620: no distinct reviewer. Accept APPROVED, first CHANGES_REQUESTED repair and later changes-requested escalation on **seeded probe evidence**, combined with today's **live** COMMENTED repair, real marker reply reviews ignored and restart idempotency. Authorize mlegls to merge #5 outside the reconciler as the stand-in human. This is an explicit acceptance/scope reduction; those three review-state boundaries are not claimed as live submissions. Keep the supplied scratch repository.

## Predictions before contact

- a lands in collector and unlocks b, while its global ticket and outside dependent stay open/blocked.
- one root PR; owner code stays unchanged before remote merge; idle workers retire.
- pr-merge: deliberately red Actions produces a bounded repair; green permits a merge commit, child-first close and clean/base owner ff.
- pr-review: ordinary PR comment does not repair; a submitted COMMENTED inline review repairs both threads; own marker reply reviews are consumed without looping; the reconciler never merges.
- exact-PID crash/start preserves PR, mode, branch, cursors and original result packets, without replaying the tree.

## pr-merge: held live

Owned directory `/private/tmp/rehearse-github-pr-ihGuRa`; root `rehearsal-merge-ihgura`; [PR #4](https://github.com/mlegls/reconcile-pr-transport-20261014-35767b2d/pull/4), branch `reconcile/pr/rehearsal-merge-ihgura-afa4aa1791dc`.

| Action / sensor | Observed result |
| --- | --- |
| Fetch/setup/readiness | Original fetched base `3ed5a61a91a2062dd19561fd65d4f3c87db2a11a`; setup/owner base `0108f9affa23cc14ee480c481ad3dcad341f76d5`; Actions check `115904227090` success. |
| a collector integration | a landed at `06ddd82b9bd841c7618defc43865d56c2a2a64e5`; b's starting HEAD was identical and contained a's code. a global stage was still ticket; outside not frontier. |
| b / root publication | b at `9740b704183e97f008b0d24743a8645817a68b0b`; staged original root `5762a1789edf42b321d939151e7d47bc6a6ee36d`; one PR OPEN, all original results pending, owner still setup base. |
| Real failed checks | Checks `115905509191` / `115905567467`, runs `38579554530` / `38579571281`, completed/failure on original root. Observed failing command: `test "$(cat fixture/ci.txt)" = green`; exit 1. Repair request named those exact checks/head. |
| Bounded repair | One production review-role worker `rehearsal-merge-ihgura-pr-repair-a`, thread `87638eae-4c62-4041-9635-ada5708c529b`. Located ci fixture changed red → green. No extra tree workers. |
| Base conflict / external push | Separate clone advanced main to `5f4989ec8ab809713e40643d3dfe80d09cd5a1df`, conflicting with a's fixture edit; real merge failed. Repair merged and resolved both meanings. Same-author separate clone pushed `e476fc7fa1f62e1228e853b84fdb47983a62ed94` to PR branch. Both are ancestors of final pushed head. No rebase or force-push. |
| Crash/start | Killed exact reconciler PID `8024`; production start resumed PID `26916`, same #4/mode/branch/cursor/results/counter=10 and existing repair worker. Tree was not replayed. |
| Located transport seam | GitHub returned stale `baseRefOid=0108f9af…` while `baseRef.target.oid=5f4989ec…` and fetched main agreed with the latter. This kept the old host waiting. `c8f19000` reads the current ref target; killed exact PID `26916`, resumed `41377`, same identity/receipts. Re-drive completed. |
| Original / repaired gates | Original gate: root reviewer and staging `5762a178…`. Repair worker gate: `33f8785ce6b023fe02ae43c0d2420962053f62ed`. Final staging gate and normal pre-push hook both named `2ead4e5fc5df479a6b98931523bbeef398335112`. pre-commit and pre-merge-commit receipts also recorded. |
| Green / merge | Checks `115908490196` / `115908515331`, runs `38580407890` / `38580415280`, completed/success on final pushed head `2ead4e5f…`. GitHub merged at `2026-10-14T14:27:02Z`; merge `43d2aaba5c274c01dd09e6ceb73446779ab75ae9` has two parents. |
| Target close / owner | Canonical tracker commit subjects in order: `close rehearsal-merge-ihgura-a`, `close rehearsal-merge-ihgura-b`, `close rehearsal-merge-ihgura`. Saved closedAt: `14:27:23.816Z`, `14:27:24.048Z`, `14:27:24.271Z`. All stage done; original summaries and evidence references preserved. Outside became frontier. Owner clean/main fast-forwarded to merge commit; ownerSync updated. Zero live worker registry rows. |

Original evidence is available at the original staged head, `docs/attachments/rehearsal/{rehearsal-merge-ihgura-a,rehearsal-merge-ihgura-b,rehearsal-merge-ihgura}.md`; PR body preserved original summaries/story outcomes and staged OID. Repair history is additional state, not replacement node results. The prototype reused the root evidence path for repair text at the repaired head; original bytes remain in its ancestor, explicitly distinguished here.

Tree worker joins (implement → drive → review) used handles suffixes a `1/2/3`, b `4/5/6`, root `7/8/9`, with exactly nine tree launches. Review thread IDs: a `47440332-0fbc-4f86-ad99-716f8ef937c2`; b `8d0aeac8-6b63-4694-ac8e-b2e0db10ea43`; root `eba2910e-d7ca-462c-9445-933518bd0c72`.

## Repeat after a transport interruption

Controller revision: the commit that added this section (journey.ts: `settle` retry on controller reads, mode/exception-aware `acknowledge`, `inject-transport` fault). Production code unchanged. Same scratch repository; owned directory `/private/tmp/rehearse-github-pr-PSzfZ6`; root `rehearsal-merge-pszfz6`; [PR #8](https://github.com/mlegls/reconcile-pr-transport-20261014-35767b2d/pull/8), branch `reconcile/pr/rehearsal-merge-pszfz6-f42a9061387a`. Single command: `bun docs/attachments/rehearse-reconciled-github-pr-landings/journey.ts pr-merge` (7 min 36 s, exit 0).

Prediction before contact: an injected 502 on the first reconciler GraphQL read after publication raises the owner exception `PR observation/publication failed`; the public acknowledgement continues the *same* saved PR to one bounded check repair, restart, conflict+contributor merge, green merge, child-first close and owner ff, with no duplicated tree workers.

| Action / sensor | Observed result |
| --- | --- |
| Fault | Wrapper `gh` on the private PATH fails the next `api graphql` once with `gh: Server Error (HTTP 502)` (receipt file `injected`). Reconciler raised `PR observation/publication failed` for #8 at head `598fb871…` with text `GitHub transport: gh: Server Error (HTTP 502)`. |
| Acknowledgement | Public resolve `answer` with a note generated from the saved exception: "Owner acknowledges a transient GitHub transport interruption (PR observation/publication failed); retry observation of the same saved PR." (no pr-review/changes-requested wording). Applied; exception cleared; PR number unchanged. |
| Continuation | Observed real failing checks `115934506056`/`115934554470` (runs `38587848191`/`38587861459`) on `598fb871…`; one repair worker `rehearsal-merge-pszfz6-pr-repair-a` (thread `8a5a6c44-18cb-47ad-9ac3-29dda4436031`); nine tree launches only. |
| Restart | Exact reconciler PID `44352` killed; production start resumed as `62482`; same #8, `pr-merge`, branch, empty review cursor, original result packets. |
| Histories | Base advance `a5279f89…` conflicted with a's fixture edit; separate-clone contributor push `7a09065f…` to the PR branch. Repair merged both (`0452d850…`), no rebase/force. |
| Gates | Original gate on staged head `598fb871…`; repair-worker gate `0452d850…`; final staging gate and pre-push hook both on pushed head `a91d36bd1eeb8cb16524818c157036f5d419c81a`. Checks on that head green before merge. |
| Merge / close | GitHub merge commit `c9082cef0dbe26554e5f9a76195edda4b93ab660` (two parents, contains `a91d36bd…`, base and contributor commits). Tracker commits in order: `close …-a`, `close …-b`, `close rehearsal-merge-pszfz6`; original result packets unchanged apart from `closedAt`; outside dependent ready; owner clean on `main` fast-forwarded to `c9082cef…` (`ownerSync: updated`); zero live workers. |
| Cleanup | Documented `cleanup`: explicit stop; branch `reconcile/pr/rehearsal-merge-pszfz6-f42a9061387a` deleted; no open PRs in the scratch repository; no process of this area left; local area retained. |

The first attempt of this repeat (`…-4mqQ8t`, #7) passed the injected 502, acknowledgement and failed-check observation, then stopped on a controller defect: the contributor commit wrote identical content to `fixture/contributor.txt`, already on `main` from the earlier merged run (nothing to commit). The file now embeds the root. #7 was closed unmerged and its branch deleted via `cleanup`.

## pr-review: held at the approved live/seeded boundary

Owned directory /private/tmp/rehearse-github-pr-jydX8J; root rehearsal-review-jydx8j; [PR #5](https://github.com/mlegls/reconcile-pr-transport-20261014-35767b2d/pull/5), branch reconcile/pr/rehearsal-review-jydx8j-6da6fe42cdc2. Live COMMENTED repair, replies/recovery and authorized external merge/target close held; APPROVED and CHANGES_REQUESTED policy encounters are explicitly seeded.

| Action / sensor | Observed result |
| --- | --- |
| Readiness / original | Setup/clean owner base fcb8db16fc87f763ef3a905aa639b7380ebba232; base check 115909935402 success. a collector/b base 245db162600dc7698f32da383fbfacc3733e6080; b reviewed 6af8d4d61470be17ce942461a4096b37944ec1f3; original root b2c590e281c447ab6be49af8911cebf25c757d08. Exactly nine tree workers; a global ticket and outside still blocked. |
| Waiting crash/start | Killed exact PID 52131; production start resumed 63051, same #5/mode/branch/cursor/original results/counter=9. No tree replay. |
| Closed-unmerged | Real gh pr close; at 14:31:54Z production raised PR closed without merge to owner. All three global stages remained ticket/spec. Reopened same #5, then public resolve answer resumed waiting. No alternative PR. |
| Individual comment | Ordinary PR comment 6170792391; after 70 seconds repairs stayed 0. |
| Submitted review | Same-author COMMENTED review 5519614588 / PRR_kwDOVJGTm88AAAABSP6ifA at 14:33:24Z, two unresolved inline threads. Production request used exact original PR head. |
| Repair / gates | One worker rehearsal-review-jydx8j-pr-repair-a, thread 0e0a84b6-18b6-4999-a360-becd9e381a37. Both fixture observations clarified. Worker gate b2dd71c7ed767f12523543ac3e283cf91586f910; integration/staging gate and pushed head fdf1f1e13cb4763c7333932f189503e73538e26c. Retired at 14:35:45.621Z. |
| Real reply reviews | GitHub created separate COMMENTED reviews 5519647373 / PRR_kwDOVJGTm88AAAABSP8ijQ and 5519649248 / PRR_kwDOVJGTm88AAAABSP8p4A for the two marker replies (material below). Both threads remain unresolved; no manual resolve. |
| Reply crash/start | After replies, killed exact PID 63051; start resumed 76453, preserving review cursor, reply receipts, firstRepairAt=14:35:44.836Z, all original results and counter=10. After another 70 seconds own reply review IDs were processed, repairs stayed 1, four total thread comments remained (no duplicate replies), no live workers, PR OPEN. |
| Final checks / owner | Checks 115913625210 / 115913658485, runs 38581885361 / 38581896281, completed/success on fdf1f1e1…. Owner remained original clean/main base; no node closed and no automatic merge. |
| Pause for human | Exact reconciler PID 76453 crash-paused with state preserved; #5 stayed OPEN until the maintainer authorized the outside-process merge. |

Small live API material establishing reply → review linkage (not seeded):

    thread PRRT_kwDOVJGTm86sXbwB; unresolved; fixture/conflict.txt:1
      original PRRC_kwDOVJGTm87-o-re, review PRR_kwDOVJGTm88AAAABSP6ifA
      reply PRRC_kwDOVJGTm87-pFJ7, review PRR_kwDOVJGTm88AAAABSP8ijQ
    thread PRRT_kwDOVJGTm86sXbwJ; unresolved; fixture/rehearsal-review-jydx8j-b.txt:1
      original PRRC_kwDOVJGTm87-o-rm, review PRR_kwDOVJGTm88AAAABSP6ifA
      reply PRRC_kwDOVJGTm87-pFfy, review PRR_kwDOVJGTm88AAAABSP8p4A

Each reply body was:

    Committed fixture clarification; integration gate passed on pushed head.

    reconcile:rehearsal-review-jydx8j:review:PRR_kwDOVJGTm88AAAABSP6ifA:thread:<its thread above>:head:fdf1f1e13cb4763c7333932f189503e73538e26c

Both reply review IDs appear in saved reviews.processed, only the original submitted ID in reviews.repaired, repairs=1. Saved replies have two receipts at 14:35:38.755Z and 14:35:44.807Z. The original evidence remains at original staged head; this loaded prototype also reused root evidence path at repaired head. The committed controller now writes repair evidence under a separate -repair path on future drives.

### Authorized external merge and completion

Predicted before the final control: saved pr-review resumes unchanged, remains waiting until the outside process acts, never requests merge itself, then proves ancestry and closes a/b/root child-first.

1. Committed controller 1883a713 installed an observational gh wrapper in the private PATH; all GitHub calls delegated unchanged, merge endpoint/mutation attempts counted separately. Production start resumed PID 33057 in saved **pr-review**, same #5 and branch; controller reported external-merge-wait.
2. From this worker's ordinary PATH, **outside** that process, executed:

       gh pr merge 5 --repo mlegls/reconcile-pr-transport-20261014-35767b2d --merge --match-head-commit fdf1f1e13cb4763c7333932f189503e73538e26c

   GitHub returned MERGED at 2026-10-14T14:49:43Z, mergedBy.login=mlegls, two-parent merge commit **35fec773c4c06ad1e5331c34ba3ed9b5dc7fe5d8**. This is the maintainer-authorized stand-in, not a different account.
3. Production observed MERGED, fetched the base, and proved fdf1f1e1… is an ancestor of the merge. Global close commit subjects were exactly a, b, root in that order. closedAt: **14:50:52.632Z**, **14:50:53.242Z**, **14:50:53.955Z**. Deep comparison after excluding only closedAt showed every original saved node result unchanged; all stage done. Outside became frontier.
4. Owner clean/main ff reached 35fec773… with ownerSync=updated. counter=10, repairs=1, zero live workers. During this resumed lifetime **44 delegated GitHub calls, zero merge requests** were observed from the private controller/reconciler PATH. No duplicated tree workers/replies or second repair.
5. Run exited successfully; exact PID 33057 absent. Unique PR #5 remote branch deleted. Merge-triggered Actions also completed/success on 35fec773…. Supplied repository retained.

To repeat external control after a fresh pr-review pauses, use two shells: journey.ts resume OWNED_DIRECTORY in one, then the displayed PR's gh pr merge NUMBER --repo <supplied repo> --merge --match-head-commit <status head> from the normal operator PATH in the other.

### Accepted seeded review controls, replayed on 1883a713

Entry: bun docs/attachments/reconcile-submitted-pr-reviews/probe.ts. [Earlier independently driven/reviewed packet](../reconcile-submitted-pr-reviews/index.md) supplies the full seeded claims; the final replay exited 0 in 87 s. APPROVED without associated unresolved threads was processed without repair/merge. R1 CHANGES_REQUESTED plus R2 COMMENTED coalesced into one repair with T1/T2; later changes-requested yielded the owner exception, no second worker/merge. Post-before-save reply recovery posted exactly twice, launched one worker, made zero host merge calls, ran five gates and closed only after an explicit contributor-side merge.

Final seeded markers used pushed head a3797b7fa1fa60eb3b46dbd8e7608d41c3fa3cfe; repair commit 08bfb5981caeb5d9fd79a3137577208fd3d00639. Second exception excerpt: Second changes-requested review after repair, with review id second, state CHANGES_REQUESTED, submittedAt 2026-10-14T14:51:38.701Z. closedStage=done; target=github:seeded/lifecycle:main. Host review submissions were seeded; Git, workers, gates and merge ancestry were real. All resources from that replay retired.

## Backend capability (seeded, compiled contract only)

Production PR body generation with a Tracker implementing `githubIssue` mapped nonnumeric logical slugs a/b/root/unfinished-parent to 41/42/43/44. Exactly `Closes #41`, `Closes #42`, `Closes #43`, `Part of #44` were generated. Vault live PR body had no closing references. No native GitHub issue adapter exists on this tested revision; the enclosing parent's live cross-backend join remains outstanding. These mappings are seeded capability evidence, not native scratch issue encounters.

## Cleanup and limits

- PRs #4 and #5 merged; both unique remote PR branches were deleted. Supplied repository, inherited branches and setup/main history remain. The parent owns final supplied-repo disposal.
- Finished merge reconciler `41377` exited; all workers retired. Review reconciler `76453` was crash-paused, resumed as `33057`, then completed/exited; all its workers retired. SSH proxies `nc` left after the intentional crashes were stopped by exact owned PIDs `30627` and `60372`, never a pattern. Neither scratch PR remains open; no owned process remains running.
- Managed-process finished-record kill refused a reported leftover; exact-PID TERM cleaned it up. Recurrence added to the existing [pi-processes friction](../../../docs/issues/managed-process-completion-notice-did-not-reach-a-waiting-worker.md).
- Local scratch directories are retained for inspection; only ticket-owned files may be removed. No browser pages, deployments or tunnels were created.
- Dirty/other-branch owner preservation is not a live claim here; prior [seeded-host actual-Git evidence](../stage-reconciled-root-for-pr-landing/index.md) is separate.
- Distinct reviewer identity and live APPROVED/CHANGES_REQUESTED submissions were intentionally removed from this ticket by the dated maintainer ruling; their accepted seeded evidence remains explicitly labeled.

## Existing regression checks

Before host repair: `bun test lib/reconcile lib/tracker.test.ts skills/enabled/all/mlegls/conventions/tracker/scripts && bunx tsc --noEmit`: 38 pass, 0 fail, 844 assertions; typecheck passed. Repaired host: same 38 tests/844 assertions pass, typecheck passed (116.93 s tests, 136 s total). No retained test was added.
