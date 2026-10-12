# Collector ledger, restart and linked-owner first use

Nonvisual API/CLI evidence; no screenshots. Tested 2026-10-12 against f184f5b,
runtime base 8648784abe2e6fbc2bc1662fc83853aa89774b7c, with the exact
[ledger.ts](ledger.ts) shipped at f184f5b. This is disposable drive machinery,
not a retained test suite. The enclosing ticket owns the combined rehearsal index.

## Reproduce / prepared setup

From any cwd, with this checkout's setup completed and Bun, Git, mise and zmx available:

    bun <absolute-checkout>/docs/attachments/reconcile-with-global-tracker-and-landing-ledger/ledger.ts

Or append one of collector, restart, close-replay, linked-owner.
The default runs all four sequentially in fresh subprocesses/module caches.
Close-replay runs two independently owned repositories (delivered and prepared cuts).
Every mismatch throws and exits nonzero. The default entry was opened from /tmp
and completed successfully in 5m 1s.

Deployment: private local mkdtemp Git repositories, no service or credentials.
Persona: explicit user:ledger-fixture tracker author; fixture Git identity.
Seed: root spec, executable a/b tickets, b blocked by a, outside blocked by a.
One shell stance per implement/drive/review role; fake pi records its initial HEAD,
writes a readiness sentinel, and sleeps. No real model client or stance decisions.
The fixture author supplies deterministic code commits and board handoffs; the
real reconciler performs scheduling, successors, gates, integration, retirement,
ledger transfer and global closure. Close-replay alone seeds delivered code and
registered saved review receipts directly.

All PI/BB/AB/session/worker/Git/tmux/zmx/tracker selectors are cleared before
dynamic runtime imports. XDG state/cache, board, agent registry/roster, zmx,
parallel slots/pressure, mise trust and PATH are isolated. TRACKER_CLI is derived
from import.meta.dir and points to this checkout. Role files are generated in
the isolated roster before importing agents.ts; PI_THREAD_RUNTIME is explicitly zmx.
Readiness requires saved chain handle, registered worker and shell-started after
real setup, not merely a PID.

Each mode retires its own registry workers, restores env/cwd, and removes its
repository/worktrees on success or failure. No shared deployment is retained.
The locators below identify the observed targets; they are intentionally cleaned,
not URLs or persistent replay targets. Reproduction creates new owned targets.

## Collector: held

Owned main: /private/tmp/rc-global-ledger-1yuI7o/repo.

Action: run a through implement → drive → review → integrate, then let the
scheduler select b. Hold root's final review report with fixture-owned
release-root, inspect canonical CLI snapshot and persisted ledger, then release.

At the pause:

| Row | Canonical own stage | Frontier | Derived claim |
| --- | --- | --- | --- |
| a | ticket | false | landed in root (awaiting target) |
| b | ticket | false | landed in root (awaiting target) |
| outside | ticket | false | none |
| root | spec | false | reconciling subtree; review by root-review-9 |

Ledger a: into root, head 431304ddca2ce9fd48c1e54c99edeffa47b552d5,
at 2026-10-12T13:45:57.847Z.
Ledger b: into root, head 19d113a16c162bc028785555fa9daeb4b74feced,
at 2026-10-12T13:46:28.501Z.
Collector: repo__worktrees/root--tree, branch tree/root, ab-parent main.

b launched exactly once: branch/handle b-implement-4, thread
2c899b91-06c1-4e31-ad11-f3cf67d9d2f9. Its recorded initial base was
431304ddca2ce9fd48c1e54c99edeffa47b552d5, containing a's landing by ancestry;
its actual a.txt read "a code\n". This is launch-time code evidence, not
a later HEAD comparison. The registry contained exactly one b implement launch.

After release: a/b/root globally done; outside frontier; run finished done;
three integration gate receipts and nine phase launches. All three ledger
destinations became the absolute owner, containing code head
dacbb8b2577eca153bc7b61b4958143872217d87. Owner HEAD later advanced to
eda2c0b4359f0ab2a7e5beebf009597dd78c513f through tracker persistence.
Owner contained a.txt, b.txt and root.txt. Global text and persisted results
each retained their own "<slug> reviewed result" and
docs/attachments/fixture/<slug>.md, including root's join packet rather than
either leaf packet.

## Restart: held

Owned main: /private/tmp/rc-global-ledger-59zbJ4/repo.

Action: stop the foreground loop by AbortSignal only after the durable a landing,
cleanup receipt and archived review thread, with b ready but unreported. Restore
that observed state verbatim with saveState and invoke actual run again from main.
No computed frontier or completion helper supplies the restart.

Cut: a into root, head 8aed3912363818fa9b137c8bec3ba1780989dd10;
saved result "a reviewed result", evidence docs/attachments/fixture/a.md;
retired review identity a-review-3; one gate receipt.
b identity remained b-implement-4, thread
018f3dac-cd80-4564-8aba-7a353de03fb7, base
8aed3912363818fa9b137c8bec3ba1780989dd10, actual a code present.

Immediately after restart: no a chain, same b handle, unchanged one gate receipt.
Final: three gates total (not four), nine launches, a's same saved result globally
closed, all own evidence retained, all ledger destinations owner, finished done,
outside frontier. Containing target landing head
b2abdb6773a5b0d7f149250c818f959025affc93; later owner HEAD
33f6e256a7eab6402cca4cbffe747872145e2698.
Thus code ancestry, identities and counted gates—not HEAD equality—establish
no repeated a worker/integration.

## Close-replay: held (two deterministic cuts)

No timed crash or sleep-based interruption. Each cut is saved before run starts.
The seed merges an actual registered saved-review branch, closes a with its own
result, and leaves b/root pending. Root operation carries b.

**Delivered cut:** /private/tmp/rc-global-ledger-XGrALx/repo;
a/b/root ledger already targets owner, root landing operation records delivered
code bf898ec34825a82815a76ea89afab1dd9008a835.
Actual run closes pending b then root and retires the saved worker.
Zero phase launches, zero integration gate receipts, all results closed,
finished done and outside frontier.

**Prepared cut:** /private/tmp/rc-global-ledger-H1OhuL/repo;
prepared head d0f2246fbc386391022bd5d3ceaae49cb6cd1d6c already merged in owner,
but no root ledger entry/landedHead exists and b still points at root.
Actual run proves prepared ancestry, records root and transfers b to owner,
then closes b before root. Zero launches and zero gate receipts; saved worker
cleanup completes; finished done only after all results have closedAt.

Both canonical histories read tracker: close a, tracker: close b,
tracker: close root (a is the seeded close; b/root are replayed).
Each global result contains its own summary/evidence. Prepared recovery's
containing ledger head is 63902de87134e2487273a9cb515895897e87a012;
later owner HEAD 7fb4ebb8fb9d85e736b8b457027fb61dcca27ff2.
Delivered-cut final HEAD 83f8bb0fb0e2182c5e521e710abd5126b43065a0.
Neither changed HEAD is counted as another code integration.

## Linked owner: held

Canonical main: /private/tmp/rc-global-ledger-FJWWVQ/repo.
Owned code target: /private/tmp/rc-global-ledger-FJWWVQ/linked-owner,
branch owned, a real absolute linked worktree.

Action: repeat the collector story and restart cut, invoking actual run from
main on restart. Persisted State.cwd remains the linked owner.
a cut head c47755695528beb1223593b864e1e42c70671915; b's launch base is
that same head, with a.txt present. b identity b-implement-4, thread
597af3a6-8cde-4b59-8974-37c769a90564, unchanged by restart.
Collector branch tree/root records ab-parent owned, not main.

At the root-review pause a/b remain globally ticket with pending-landing claims,
outside is not frontier, and b's collector landing head is
958753638c1cf6401a662aa17c669499c9966595.

After release: all ledger into values equal the absolute linked-owner path,
all containing heads ee1aa5a20390b993668190474e6f3fb2b2525096.
Linked owner contains all three code files; canonical main contains none.
Tracker closures/results are readable from main; evidence locators remain each
node's code artifact paths, with no attachment-copy requirement. Outside becomes
frontier, run finishes done, nine launches and three gates total.

## Regression / friction

    bunx tsc --noEmit && bun test

Typecheck passed; 226 passed, 2 existing skips, 0 failed across 51 files,
12,418 assertions. Skips: concurrent thread workers and selected-project-vault
CLI parity.

First full run exposed seven system-prompt tests whose mock omitted
getActiveTools after tool-catalog activation. Isolated rerun reproduced the
same TypeError. Located two-minute fixture repair committed separately as
3f07f77: supply the real tool API shape, without adding tests or weakening
assertions. Re-drive: seven prompt tests passed, then the full suite above
passed. No unresolved friction or product/runtime changes.
