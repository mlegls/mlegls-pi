# Independent core join drive

Revision: 3663f440dbd0cf064aaeb1142e6a47731b49a0ed. CLI/agent encounters only; no source, tests or fixture implementation read.

## Predictions before opening the product

1. Fresh pi loaded from this worktree dispatches a worker whose integration parent is this dispatcher's branch. Its tagged board report identifies that worker; integrate removes its thread, zmx terminal, worktree and branch, without touching this driver.
2. Archive of a conflicting two-level owned tree retires the early sibling, asks only the conflicting child, holds ancestors until fresh child done, then retires child before parent.
3. Merge has the same lifecycle: a blocked child retains child/ancestors and its marker; resolving and retrying retires only remaining nodes.
4. New/fork/promote and literal send/history preserve session identity and history across the CLI/worker join. Literal text does not execute until CR; current-session replacement is followed instead of newer unrelated sessions.
5. Nested reconciler workers use the actual destination branch, not their collector comparison SHA, as integration parent; completed campaign leaves no owned resources.

## Authorized setup

Deployment: local git/pi/zmx, this owned worktree for the join and newly prepared disposable projects for other journeys. Persona: existing local pi authentication via isolated agent directory and temporary auth link. Entry points: committed fixture commands in index.md. Inherited identity/state is not a fixture selector. Predictions above precede setup and interaction. All fixture roots will be regenerated, not historical roots reused.

## Encounter and expectations

All direct CLI/worker joins held after correcting the driver's dirty setup. Production revision stayed 3663f44 throughout; a38190f committed the predictions and initial refusal, and e7565dc is the successfully integrated empty worker commit.

- **Fresh tools / prediction 1 met after setup correction.** First join on /private/tmp/wm-thread-951rvi dispatched worker 0be5288f… correctly, but integration refused the uncommitted prediction log. The fixture still emitted done fixture-join-complete and exited 0; its structured result said blocked and workerRetired:false. This was an appropriate product refusal, not an integration defect. Fixture cleanup retired the remaining resources. Committed the log, regenerated /private/tmp/wm-thread-Ie0z4x and retried. Fresh pi b3a64787… dispatched c2ab8b51…; report mupm6sb7-jwvwxz identified that worker. Its ab-parent equaled thread-core-and-workers-on-zmx-drive-j. Integration landed e7565dc, deleted join-Ie0z4x branch/worktree and closed the worker. Pre/post CLI/zmx inventories were empty after retiring only the driving guest. See independent-join.json (first refusal) and independent-join-readback.json (retry).

- **Archive / prediction 2 met.** Prepared done target /private/tmp/ab-lifecycle-yRKfFY; six canonical agents completed fixture-ready. Invoked this checkout's bin/ab thread archive 015e9335-7f2a-4204-aa43-000268c7ae1e with the printed isolated selectors and inherited identities unset. Concurrent inspect after 2 seconds showed early dbc37377… archived, child a05b80b8… and parent active, main still edce25a, and conflict mail only to mail/dadb2791. Child fresh done mupmj9yc-h47vzf resumed the command; exit 0 closed early → child → parent. Main contained resolved-child. The child-cwd leftover pid 33285 was absent and unrelated main peer 40770 remained alive. See independent-cli.json → archiveWaiting/archive/archiveAfter/readbacks.

- **Merge / prediction 3 met.** Prepared blocked target /private/tmp/ab-lifecycle-Bm6Y1o and ran bin/ab thread merge 4170dccb-9d41-414b-8a53-26bcb128e32d. Only child f5f988b7… received conflict mail. Its fresh blocked mupmjqnj-2scibc made merge exit 1; early 4d8e074f… alone retired. Inspect retained child/parent, terminals and the exact blocked marker, with main unchanged. Ran committed fixture resolve ROOT child, then repeated merge. Exit 0 closed child → parent only, cleared marker and put resolved-child in main. See independent-cli.json → mergeBlocked/mergeState/mergeRetry/mergeAfter.

- **Identity/transport / prediction 4 met.** New shell owner 0b92b295… returned parseable JSON. Sent printf 'DRIVE-$HOME-;-[brackets]' literally: history showed typed text only; explicit CR produced literal output. Forked registered guest 4f9b3439… with its valid PI_SESSION_FILE plus deliberately stale PI_SESSION_ID. Returned b36faf4f… retained parent = 4f9b3439…; saved public session contained copied fixture-ready user/assistant turn followed by new session-meta thread=b36faf4f…. Started free saved pi with mise exec -- pi --approve --session ROOT/free.jsonl --print, then promoted using file + stale id: guest id/sessionId 01a0f7d9-fedc-75d0-acf1-37e231c25cbf matched its saved header. An initial driver command incorrectly assumed bin/pi existed; corrected to the documented pi executable. See independent-cli.json → cliCommands/freePi/promote.

- **Worker report/current-session join / prediction 4 met.** Committed worker entry created 5ed4622d… and bootstrap report mupm7rvx-5rhfid on worker-fixture/pi-worker from that exact session. Literal follow-up left report cursor unchanged until CR, then mupm81u2-uhf9ki arrived. Jump returned canonical rather than newer free session, then followed replacement 01a0f7d0-f694-760c-bd07-d60bfe903602. Hand-resumed canonical ed37d299… reported on thread/id with matching session-meta; free pi had neither automatic thread report nor thread metadata. Missing/unreadable live state and failed zmx observation produced no fabricated exit; explicit agent/pid kill did. See independent-worker-readback.json.

- **Nested destinations / prediction 5 met for observed lineage; collector-base condition unobservable in this readback.** Reconciler killed/restarted its first worker, relaunched it and completed ten workers. Every leaf worker recorded tree/fixture-nested; nested workers recorded tree/fixture-root; root workers recorded owner. Collector lineage agreed, all ten workers archived, collector/chain/exception maps emptied, owner received leaf content and main stayed at seed. See independent-reconcile-readback.json. This fixture output does not expose dispatch base SHAs. The earlier packet's comparison-base evidence is unchanged, but this drive does not independently establish the collector-SHA premise; the core ticket's reviewer owns that measurement, not a waived gate.

## Replayable checks

1. Commit predictions before join. Prepare and run join ROOT on an owned non-main package checkout. Accept matching worker/report session, ab-parent = dispatcher branch, landed worker commit and disappearance of only that worker from thread/zmx/worktree/branch inventories. Negative setup control: dirty destination must refuse without losing worker; fixture completion status must not be mistaken for integration success.
2. Prepare done; run actual archive CLI concurrently with inspect after 2 seconds. Accept unchanged main, early retired, child-only conflict mail, retained child/parent and fresh exact-child done preceding post-order retirement. Check resolved-child content, retired child pid absent and unrelated peer alive.
3. Prepare blocked; merge parent, inspect, resolve child with committed entry and retry. Accept exit 1 and identical persisted marker initially, ancestors retained and early retired once; retry exit 0 retires only child/parent and clears marker.
4. New shell; send text containing literal dollars/semicolon/brackets; history before/after CR. Accept no execution before CR and exact literal output after. Fork a completed registered pi with valid file + stale id; accept copied messages and resolved source parent. Promote free saved pi with stale id; accept saved header id/file retained as guest.
5. Run worker ROOT; accept report canonical identities, no report until CR, jump following registry replacement rather than newer free session, canonical-only automatic thread metadata/report and no synthetic exits on failed observations.
6. Run reconcile ROOT on isolated owner branch. Accept per-level destination lineage and archived workers, owner content with main unchanged. Independently capture public launch/comparison base SHAs alongside those destinations to establish the collector-SHA condition (not supplied by this fixture's current output).

## Frictions and cleanup

The join fixture's successful exit/done marker can conceal a blocked integrate; review its embedded integrationResult. Observation filed with the existing [fixture tooling owner](../../issues/thread-fixture-help-and-headless-pty-entry.md). Its verbose lifecycle inspection output required saving and selecting fields (same owner). Logging in the destination checkout before integration requires committing first, an expected clean-tree prerequisite but easy to miss.

All four prepared roots and scratch auth links were removed. Fixtures reported empty active thread/terminal/live sets; independent checks found roots absent, no join-* branch/worktree and no selected child/peer/daemon pids. See independent-cleanup.json. No browser, desktop, dev server, tunnel or shared deployment was opened or stopped. No product repairs or tests were written.

## Review (join pass)

Reviewed 1b705b8..ad9eee3 against the ticket and the independent drive. No production change in the range; the diff is the `join` fixture action, evidence and issue bookkeeping. The fixture's join/supervisor branch share one code path and its `inventory` helper reads this checkout's `bin/ab`, as the ticket requires.

**Collector-SHA premise (the drive's open item).** Source: `lib/reconcile/reconcile.ts` `launchNow` passes `base` (a SHA) and `cwd: into` independently; `lib/thread/runtime.ts` `newThread` does `git worktree add -b name path <base>` and then records `ab-parent = spawning.branch`, so the two cannot be conflated. Measured with a retained unit test, `lib/thread/runtime.test.ts` "a worker spawned from a collector's older base SHA records the collector branch as ab-parent": a collector thread lands a commit past the comparison SHA, a worker spawned from it with `base: <comparison SHA>` has HEAD = that SHA (not the tip) and `branch.<worker>.ab-parent` = the collector branch. Passes. Replays the drive's check 6 and the packet's note that comparison bases are not merge targets, at unit scope (no pi, no model).

**Other checks.** Left as evidence, not retained: join/archive/merge/identity/worker journeys are already guarded by the child suites (lifecycle, runtime, wm.local); the join fixture's outputs (ids, counts) only confirm this ticket's cutover. `bun test lib/thread lib/dispatch.test.ts lib/wm`: 26 pass, 1 skip (opt-in wm.local); tsc clean outside the nested obsidian-tracker dependency (needs its own install, per checks.txt). The repo has no `test:affected` task.

**Friction, already owned.** The join fixture exiting 0 on a refused integration is filed under thread-fixture-help-and-headless-pty-entry; not changed here, the fixture is out of this join's production scope.

**Structure.** Four code paths read `branch.<b>.ab-parent` (runtime `mergeParent`, lifecycle `integrateThread`, `wm.merge`, `dispatch.retire`). They differ in error handling (lifecycle distinguishes unreadable from absent; retire treats absent as unmerged) and `wm.ts`/`dispatch.ts` are slated for workmux removal ([[projects/mlegls-pi/issues/delete-workmux-and-tmux-paths]]), so no consolidation was made. Nothing else duplicated across the children surfaced.
