# Independent ledger first-use drive

## Predictions before use

Tested revision: ad18fed7529e77b38b4201f05b625eb2e54deb30. Source, tests and diffs not inspected.

Prepared setup: worktree setup completed per supplied notification. CLI-only isolated local shell fixtures; persona user:ledger-fixture, no credentials. Entry point is this checkout's ledger.ts, invoked from /tmp. Each mode owns fresh private repositories and cleans its own resources. No inherited deployment reused.

From the ticket and user-facing ledger.md, I expect:
- collector: a/b remain globally open during the root pause; a has a pending-landing claim, b launches once with a code, outside stays blocked. Release closes a/b/root with separate results and releases outside.
- restart: durable a landing survives restart without another a worker/integration; b uses collector code and saved a evidence closes unchanged.
- close-replay: delivered and prepared deterministic cuts replay child-first closes without workers or reintegration; finished only after pending closes.
- linked-owner: restart from main respects persisted linked target; collector parent and ledger name that owner; code absent from canonical main while global closures remain readable there.

## Planned checks

Run the documented default from /tmp (all modes sequentially). Accept exit 0 only with observable per-mode pause/cut/final measurements supporting the predictions, not merely success counts. No browser journey or screenshots are required.

## Encounter

Command executed from /tmp:

```sh
bun /Users/mlegls/dev/mlegls-pi__worktrees/rehearse-collector-ledger-and-owner-restart-drive-o/docs/attachments/reconcile-with-global-tracker-and-landing-ledger/ledger.ts
```

Exit 0 after 5m 9s, no stderr. All four named modes completed (close-replay produced two cut observations). Actual launches and landings were reported before the final measurements. Readiness was operationally observed through successful shell phase launches, deterministic reports and integration receipts, not inferred from a responding URL. This is fixture-backed API/CLI evidence, not real model behavior.

### Collector — held / prediction met

Owned target /private/tmp/rc-global-ledger-oIvimu/repo.
At the withheld-root-review sentinel, a/b were ticket, done=false, frontier=false with "landed in root (awaiting target)" claims. Outside retained blocker a and frontier=false; root remained spec/review. Ledger a into root at 04b22239bb9a8ab25cf1e695a04536d7452e5ea9; b into root at 6d172be1614878fe6dde9ed8dbe7b2c837c47593. Collector tree/root had parent main.
b-implement-4 (thread 3d48ebd9-927d-41b9-9423-0ac0695cf6fc) started from exactly a's landing head and read "a code\n". Launch sequence contained one b implement, three phases per node, nine total; gates advanced from two at pause to three final.
Final run finished done, outside frontier=true, all ledger entries targeted the absolute owner with containing head da48fa1a5fa0119fea9695dbf07ed9cdb2f94584. Results a/b/root each had closedAt and their own reviewed summary and docs/attachments/fixture/<slug>.md; root used root.md, not a leaf packet.

### Restart — held / prediction met

Owned target /private/tmp/rc-global-ledger-4IrvfA/repo.
Saved cut: a landed into root at 8eff0d78c324608eeae5bce667a92ccaf4ede910, with a's reviewed result/a.md, retired review identity a-review-3, b handle b-implement-4 and one gate.
Pause retained b-implement-4, thread 8d66db15-0770-4de3-8227-43424c8e8761, launch base equal to that a head and a code present. Final total remained nine launches/three gates, rather than repeating a; saved a summary/evidence reached closure. All ledger destinations owner, finished done, outside frontier=true. Containing code head 4093a1e4ce74ff0c9b298d88e23657003ccdbfb4 differed from final HEAD f719a706e582a857d7a230a2839c821676f98ff9: receipts and identities, not HEAD equality, support idempotence.

### Close replay — held / prediction met

Delivered target /private/tmp/rc-global-ledger-dWce2y/repo: a already closed, b/root pending, all ledger entries owner at a823ee85a6894d12f245ab29936d1883563ad19a.
Prepared target /private/tmp/rc-global-ledger-XnyYHg/repo: a closed, b/root pending, prepared head eb052cc4bc45ff58872a0bc50228ee1af9da3b61; b still into root and root absent from ledger.
Both actual runs reported zero worker launches and zero reintegration gates. Tracker history ordered close a, close b, close root. All results retained their own evidence and closedAt, with finished done and outside frontier=true. Prepared recovery transferred b and created root's owner ledger entry at 0559b20242e706f8b729eca3736d3ca58b284e24. These were seeded cuts, not observed timed crashes.

### Linked owner — held / prediction met

Canonical main /private/tmp/rc-global-ledger-POe86d/repo; owned target /private/tmp/rc-global-ledger-POe86d/linked-owner.
Restart cut a head 2036fc2cdcdcb1f6eddddfef8ed1c4d021d46845 matched b's launch base; b handle b-implement-4, thread 4c2bcfe7-efc2-4bb4-a59c-506bfa19f8f3, with a code. Collector tree/root parent was owned, not main. Pause again showed globally open a/b and blocked outside.
Final cwd and every ledger into equaled the absolute linked owner, head 5ab1c1c92ab6416c4d89ac2f7602969bd062cab7. mainLacksCode=true and trackerResultsInMain=true. Nine launches, three gates, all own results closed, outside frontier=true, finished done.

## Frictions and expectations during use

No failed story or unresolved tooling friction encountered. The console's large single-line RESULT records required deliberate inspection; selected measurements are summarized here rather than retaining raw output. All four pre-use predictions were met. An additional expectation formed at restart was that final HEAD could advance due to tracker persistence; met, with receipt counts preserving the no-reintegration observation.

## Replayable checks

Append collector, restart, close-replay or linked-owner to the command above to isolate a journey.
- collector: inspect withheld-root pause for open stages/pending claims and outside blocker; compare b base/a code with a ledger head; after release require distinct closed results and outside frontier.
- restart: compare saved a result and b identity/base with pause/final; accept only nine launches and three gates, with unchanged leaf result.
- close-replay: require both cuts, zero launches/gates, b close before root, all pending closedAt before finished done, and prepared ledger transfer.
- linked-owner: require parentBranch=owned, final cwd/ledger into=linked owner, mainLacksCode and trackerResultsInMain both true.

## Cleanup / limits

Process exited normally. Independently checked all five reported fixture parent directories: none remained. No server, browser, tunnel or shared deployment started. Source and fixture internals were not read; observations come through the approved CLI and its measured reports. No production repairs or tests performed. Nonvisual evidence; screenshots: none.

## Review and final re-drive

Reviewed the diff from 8648784abe2e6fbc2bc1662fc83853aa89774b7c, this first-use log,
GlobalRunState and the surrounding scheduling/landing/closure and thread APIs.
No production defect found. The separate system-prompt fixture repair supplies
the tool API consumed by the extension; its retained assertions are unchanged.

Repair 05a2972b174bb3f854bcef5e4306d3455e210eb5 strengthens disposable measurements:
missing canonical rows can no longer pass negative pause checks; both leaves
must remain ticket/open/non-frontier with pending claims and collector ledger
entries, outside must retain blocker a, and root must remain spec. Restart now
requires one gate at the cut, the same b thread as well as handle, and the full
saved a result (parent, summary, evidence and handoff), unchanged through closure
except for closedAt. Collector/restart/linked-owner require nine phase launches,
not merely a printed count. No retained tests added or assertions weakened.

Final re-drive: same default command as above, replacing the checkout name with
rehearse-collector-ledger-and-owner-restart-review-q, from /tmp at 05a2972.
Exit 0 in 4m 59s, empty stderr; five private fixture repositories, all four modes
held. Each report followed saved-chain/registered-worker/shell readiness.

| Story | Observed cut/pause and final outcome |
| --- | --- |
| collector — held | Target /private/tmp/rc-global-ledger-ha5Njd/repo. At withheld root review, a/b ticket, done=false, frontier=false, each claimed landed in root (awaiting target); outside blocked by a and non-frontier; root spec. b-implement-4, thread 4b4bbce9-1c14-4bd6-99cd-071d4ab30a17, started at a landing 9c0b68ee7d54f11470a766d49f211d1995953271 and read a code. Two gates at pause, three final, nine launches. All ledger entries reached owner at 2287424cc4526dee057bcf03be09ec826107bcb9; all own results closed, outside frontier, finished done. |
| restart — held | Target /private/tmp/rc-global-ledger-9FC8rs/repo. Cut after archived a-review-3: a ledger into root at 9c702e40bc72f932f3be219a58b6889e86221c51, one gate. b-implement-4/thread 9dfeba24-88c4-4ea7-a1bc-3c80ba4c676f retained across restart, initial base equal to a head, a code present. Full saved a result retained, adding only closedAt. Final nine launches/three gates, ledger owner at b98c2cdf790fc41abf133dfbceed823ef5496726, all own results closed, outside frontier, finished done. |
| close-replay — held | Delivered target /private/tmp/rc-global-ledger-36F8Dm/repo, prepared head 5b3d91353477ac5552f46021f1909740cb166b3d. Prepared target /private/tmp/rc-global-ledger-K1zIq1/repo, prepared head bd319352de034f11ace7124ec18bca645f07b19f; root absent from initial ledger, b into root. Both cuts have a already closed, b/root pending. Actual run launched zero workers, ran zero integration gates, and canonical history ordered close a (seed), b, root. Prepared recovery recorded root and transferred b to owner at d9510336de9f1fbd70b8df010e94a0e661503252. Both finished done with every result closed and outside frontier. |
| linked-owner — held | Main /private/tmp/rc-global-ledger-dF53Ke/repo; target /private/tmp/rc-global-ledger-dF53Ke/linked-owner. Restart invoked from main retained persisted target and b-implement-4/thread ad4442e3-be12-456a-ab53-01b54b98895f. b initial base equaled a head 357c875383014c5a553dbf0537dcea2ce52dbb1c, a code present; collector ab-parent owned. Pause leaves remained globally open with pending claims; outside blocked. Final all ledger into values equal linked owner, head 5caa9b360ac38b7170628508e8f97f2eaed32ec4; main lacks delivered code, global results readable from main. Nine launches/three gates; all own results closed, outside frontier, finished done. |

Every final result keeps its own reviewed summary and docs/attachments/fixture/<slug>.md;
root uses root.md rather than either leaf's packet. Code files are present in owner.
Code heads and tracker-persistence HEADs are distinguished by the fixture; gate
receipts and identities establish restart idempotence, not HEAD equality.

Checks: bun test extensions/system-prompt/index.test.ts — 7 passed, 25 assertions;
bunx tsc --noEmit — passed before and after the measurement repair. No affected-test
mise task is declared. These are the retained checks affected by the change; the
ledger journeys remain disposable drive machinery, not a new test suite.
No unresolved friction or expectation, and no issue to triage/file.

Cleanup independently checked: all five exact fixture parent directories were
absent after exit. No browser, service, tunnel or shared deployment started.
Isolation tradeoff: separate subprocess/module cache and repository per mode
(two repositories for close-replay), five repositories total, 4m 59s for the
complete re-drive; no model calls. Original first-use record above is preserved.
