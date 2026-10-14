# Owned live GitHub PR landing rehearsal

Nonvisual CLI/API/Git evidence. Production host/start/run/state/dispatch/integration/gates/retirement/closure; deterministic shell phase workers, not paid models. No ledger writes by the controller. Git hooks stayed enabled. This packet is **in progress**, not acceptance of both primary journeys.

## Setup and repeat

Authorization: supervisor supplied only private `mlegls/reconcile-pr-transport-20261014-35767b2d`; preserve that repo and its inherited branches. `gh api user` returned `mlegls`, repo permission ADMIN, default `main`, Actions enabled. SSH clone/fetch/push succeeded. No credentials were copied or printed. A distinct human reviewer is still unavailable. A contributor push uses a separate clone as `mlegls`, explicitly approved by the supervisor; it is not evidence of a second GitHub identity.

Code under test: initial implementation base `d1d17ed4`; repaired production host `c8f19000`; committed controller `785e00e6`. The tested revision of this packet is the commit containing this file; later human evidence will append its tested head.

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

Automated: setup, tree phases, CI repair, base/contributor histories, restart, close observation, COMMENTED submitted-review repair/replies. Required humans: distinct-account approval/changes-requested review boundaries and human merge. No seeded review substitutes for those live primary requirements.

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

## pr-review: pending live human boundary

The second live journey is running. This section will record its PR/check/submitted review/thread/reply IDs and restart cuts before asking for human action. It is not yet held.

## Backend capability (seeded, compiled contract only)

Production PR body generation with a Tracker implementing `githubIssue` mapped nonnumeric logical slugs a/b/root/unfinished-parent to 41/42/43/44. Exactly `Closes #41`, `Closes #42`, `Closes #43`, `Part of #44` were generated. Vault live PR body had no closing references. No native GitHub issue adapter exists on this tested revision; the enclosing parent's live cross-backend join remains outstanding. These mappings are seeded capability evidence, not native scratch issue encounters.

## Cleanup and limits

- PR #4 merged; its unique remote PR branch was deleted. Supplied repository, inherited branches and setup/main history remain. The parent owns final supplied-repo disposal.
- Finished reconciler `41377` exited; all workers retired. An SSH proxy `nc` left after the intentional crash was stopped by its exact owned PID `30627`, never a pattern.
- Local scratch directories are retained for inspection/resume; only ticket-owned files may be removed. No browser pages, deployments or tunnels were created.
- Dirty/other-branch owner preservation is not a live claim here; prior [seeded-host actual-Git evidence](../stage-reconciled-root-for-pr-landing/index.md) is separate.
- Distinct reviewer identity, initial live CHANGES_REQUESTED repair, later request exception, approval and human merge still require authorization/actions; partial COMMENTED evidence will not waive these.

## Existing regression checks

Before host repair: `bun test lib/reconcile lib/tracker.test.ts skills/enabled/all/mlegls/conventions/tracker/scripts && bunx tsc --noEmit`: 38 pass, 0 fail, 844 assertions; typecheck passed. Repaired host: same 38 tests/844 assertions pass, typecheck passed (116.93 s tests, 136 s total). No retained test was added.
