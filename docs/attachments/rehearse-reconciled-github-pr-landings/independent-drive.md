# Independent first-user drive

Tested revision: a2e9b1b72c400d4486d67c9ee9cd2a506ffbdc85. Nonvisual CLI/API/Git encounter; no source, tests or fixtures inspected.

## Predictions before contact

From the ticket, guide and prior recording: pr-merge should start from a clean scratch owner, integrate a then b without globally closing either, publish one PR, repair a real failing Actions check, preserve external/base histories across restart, then merge and close child-first. pr-review should preserve the same tree across restart, ignore an ordinary comment, repair a submitted COMMENTED review once, reply without recursion, and wait for a separately authorized merge. APPROVED and CHANGES_REQUESTED remain seeded-only under the maintainer ruling; unchanged recordings can be replayed as evidence, not relabeled live. Closed-unmerged should raise an owner exception. Native GitHub tracker remains unobservable on this handoff.

## Setup preflight

Supplied retained private repository: mlegls/reconcile-pr-transport-20261014-35767b2d; explicit reuse authority in ticket. API reports push/admin access and default main. No open PRs before contact. Worktree setup completed per supplied log. Entry point is the documented journey CLI, which owns isolated local state and waits for Actions readiness before reconciliation. No new repo, tokens or permissions authorized.

## Encounter

1. Ran documented `bun docs/attachments/rehearse-reconciled-github-pr-landings/journey.ts pr-merge`. Preflight confirmed mlegls/ADMIN, Actions enabled, fetched main 35fec773c4c06ad1e5331c34ba3ed9b5dc7fe5d8. Owned area `/private/tmp/rehearse-github-pr-ftlUxQ`. Readiness succeeded: check 115924417561, run 38584979287 on setup base efb3feafbc061e90f9c99f29690e12d79f41f360.
2. Nine tree workers launched. a review thread e8e45b3f-f6bb-4c39-8d26-ee03cc5dfee9 landed a3b7fd70c0ea555abd9ab1c3a76c7c408fad3953; b started on that head, while a global stage remained ticket and outsideBlocked=true. b review thread 4353eb34-710e-49db-a8a9-a20b20d4b130 produced 78b5bb8f4968a32c69f18705d9e8c560f6e96c62. Root review thread 504292cb-afe3-444e-baec-bb8e49cadcd3 produced 0cdf8ed8b78da0dc2afe2d3bd1436155638a73b0.
3. One real PR [#6](https://github.com/mlegls/reconcile-pr-transport-20261014-35767b2d/pull/6), branch reconcile/pr/rehearsal-merge-ftluxq-2e6b036593ca, published original a/b/root packets. ownerUnchanged=true. Real check 115925823719/run 38585369620 failed; 115925871672/run 38585384501 was initially pending and later failed. Seeded body capability printed Closes #41/#42/#43 and Part of #44; realAdapterAvailable=false.
4. Before repair, controller exited 1 on owner exception `PR observation/publication failed`: `gh: Server Error (HTTP 502)`. No product repair attempted.
5. Ran public `journey.ts ack AREA`: applied=true, but acknowledgement inaccurately referred to later changes-requested and human merge. Ran public `resume AREA`: production PID 87925, same pr-merge/#6/branch/original results, counter=9; no tree replay. It observed failedCheck then exited 1 on `GitHub transport: gh: Not Found (HTTP 404)` from checks/restList. Direct gh pr view still succeeded: OPEN, original head, mergeCommit=null; gh api user returned mlegls. Recovery did not complete the story.
6. Stopped further journeys per ticket's observed-gap instruction. Existing pr-review, seeded review states, merge/base/contributor/restart histories and owner-dirty recordings were read as historical evidence only, not relabeled independent live observations. No tests/source/fixtures inspected or tests run.

## Expectations and outcomes

- Met: authorized setup/readiness; a unlocks b only locally; one root PR with owner unchanged and saved results; real failed check visible.
- Met in limited public recovery: saved mode/PR/results survived acknowledgement/start without tree replay.
- Not met: documented repeat reaches bounded repair and merge. Transport exceptions interrupted it twice. Root completion, gate-on-repaired-head, child-first close and owner ff unobservable in this repeat.
- pr-review and remaining live/seeded stories unobservable in this repeat; earlier packet remains separate evidence.

## Frictions and replayable checks

[Filed friction](../../../issues/scratch-pr-rehearsal-transport-interruption.md): transient transport interruption aborts repeat; public ack's fixed note mismatches the actual exception. Replay documented pr-merge, acknowledge a transport exception, resume same owned area; accept continuation to one bounded repair on the same PR and accurate acknowledgement, without duplicate tree workers. Then green checks must correspond to pushed head before automatic merge. This encounter cannot establish whether 502/404 originate in GitHub or controller transport, nor that a retry policy would be safe.

## Cleanup

Documented cleanup completed: explicitStop=true, #6 closed unmerged, unique remote branch deleted, local area retained. Direct API confirmed CLOSED/null mergeCommit at original head. Exact production PIDs 66792 and 87925 absent on ps. Retained supplied repo/main and inherited history belong to parent; local scratch retained for inspection. No browsers, accounts, tokens, deployments or tunnels created. Original successful recordings are not modified by this cleanup.
