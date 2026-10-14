# Independent first-use log

Tested revision: `715ec08d87ea3a284650ab2957685b5868355acf`.

## Predictions before opening the product

From the ticket and committed setup guide only (no source, probe internals, tests or diffs read):

- Publication-save interruption should resume the same PR identity, retaining the body and reviewed results without closing the root.
- Pending checks should wait without workers; API errors should become resumable owner exceptions, not successful empty checks.
- Failed CI should launch a bounded isolated repair worker; gates should run before normal pushes, and recovery should reattach rather than duplicate workers.
- Contributor race and advanced/conflicting base should preserve every history through merges, rerun gates, and retire repair workers only after successful push.
- Closed-unmerged should raise an exception without closing the ticket. Observed merged should prove ancestry and close even when owner unavailable.
- pr-review should never merge; pr-merge should use a fresh head guard only when all reported checks pass, including an empty set.
- A newly published zero-check PR should merge without a poll grace period.

## Setup checked

Persona: developer invoking the supplied library/CLI rehearsal. No authentication. Owned target: new invocation-specific disposable `/tmp/rc-pr-lifecycle-*` scratch remote and checkouts, not canonical checkout or live GitHub. Typed host seeds remote observations; Git, shell workers and declared gates are real according to the committed setup guide. Worktree setup was reported complete. Entry points: `bun docs/attachments/reconcile-pr-checks-and-branch-updates/probe.ts` and same command with `publication-zero`. No server readiness needed; the entry performs setup and verifies shell readiness itself. Inherited deployment selectors are cleared by the committed entry per its guide.

## Encounter

Both entry points exited 0: normal mode in 85 seconds, publication-zero in 47 seconds. Actual owned targets were `/private/tmp/rc-pr-lifecycle-D6Gg0I` and `/private/tmp/rc-pr-lifecycle-NssnhT`. Both reported resources retired; no resident server or browser was opened.

| Prediction / story | Observed result | Outcome |
| --- | --- | --- |
| Recover publication identity | Saved opening phase had no number after publication cut; create count remained one through recovery and terminal closure. | met / held |
| Wait without workers; API error is not success | Supplied rehearsal completed its waiting checks. API-unavailable observation surfaced an owner exception with exact head and PR URL. | met / held |
| Bounded repair, gates and exact recovery | Recovery receipt reported `repair-1`, one live launch and one integration failure. Declared pre-integrate failure produced a merge-only re-drive request naming staging/base/head rather than a push. | met / held |
| Preserve contributor and base histories | Real race yielded repaired head `3015242d1e9eac3e0b80c76aba3f14a0d38f8d2a`, foreign commit `8c1980f02a58a81e3c950f10c288b6878dfb0ab6`, retirement true. Base advanced and conflicted; final head `5c56c5dd4281ea128aba83414d00f84f0f5bf592`, two repairs. Supplied ancestry/gate checks completed successfully. | met / held |
| Exhaustion is resumable owner exception | Third failing check produced budget-exhausted exception including build name, exact head, URL and log excerpt. | met / held |
| Closed PR cannot close ticket | Observed phase closed, stage ticket, creates one; exception instructed reopening the same PR. | met / held |
| Review never merges | After repair/base/conflict journey, mergeCalls remained zero. | met / held |
| Proven merge with unavailable owner | Observed merge `5d4f895bb488939aa72c511763020460666bbd4b`, target seeded main, ownerSync left, stage done; one guarded merge call and one create. | met / held |
| Fresh zero-check publication merges immediately | Second invocation reported one create, one merge call, head `2da072af5ad72cc389efe5ad6652012512dee2bf`, merge `128b9441dc37bfd4372e9aa16cde53cdfd0342bd`, ownerSync updated. | met / held |

Normal invocation reported 11 gate runs and four merge hooks. The gate failure, API error, exhausted budget and closed PR were intentional seeded encounters, not unexpected run failures.

## Frictions and evidence limits

No unexpected friction encountered through the supplied entry points. Output is primarily an end-of-run summary: receipt details and terminal states are visible, but silent assertions (waiting workers, ancestry and gate ordering) are evidenced by successful completion of the committed rehearsal rather than a separately instrumented observer. No implementation or probe internals were inspected. Remote GitHub observations are seeded; real hosted CI and submitted-review/reply behavior are not claimed here and belong to the later rehearsal in the parent plan. Regression tests and typecheck are implementer/reviewer responsibilities, not rerun in this drive.

## Replayable checks

1. Run the normal entry above. Accept only exit 0 with one create after publication cut, one live repair launch at recovery, retired repair after race, two repairs after conflict, zero merge calls in review, closed stage ticket, and merged stage done with ownerSync left. The induced gate refusal must show a merge-only re-drive request; API and budget failures must retain head/diagnostics.
2. Run `publication-zero`. Accept only exit 0, creates=1, mergeCalls=1, recorded head and merge OIDs, ownerSync updated, and resources retired.
3. In either mode, distinguish seeded host URLs (`example.invalid`) from real Git identities and gate/worker execution; neither invocation establishes live GitHub behavior.

All predictions met within the supplied rehearsal's surface. Packet is nonvisual; no screenshots apply.
