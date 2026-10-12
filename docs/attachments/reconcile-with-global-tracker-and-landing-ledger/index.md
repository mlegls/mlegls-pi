# Global Tracker / landing ledger: combined rehearsal

Independent verification of the combined revision: [driver encounter](drive.md) (all nine modes held).

Nonvisual CLI/library evidence (`visual: false`, `shots: []`). This packet joins
six integrated children; production behavior is exercised by deterministic shell
workers and reports, not model decisions. The outer parent owns the instructions/
backend cross-child drive and installed-package cutover.

## Prepared setup and entry

Required: checkout setup (`mise run setup`), Bun, Git, mise and zmx on PATH.
This worker's setup completed before first use. No credentials or network service.

From **any cwd**, using an absolute checkout path:

```sh
CHECKOUT=/absolute/path/to/mlegls-pi
bun "$CHECKOUT/docs/attachments/reconcile-with-global-tracker-and-landing-ledger/rehearse.ts" all
```

Omitting `all` is equivalent. To inspect a single journey, replace `all` with a
mode in the table below. Invalid modes exit 2 before starting a fixture. The entry
runs each committed script in a fresh subprocess/module cache and stops on the
first nonzero exit; `close-replay` itself runs delivered and prepared cuts.

Each fixture owns new private `/tmp/rc-global-*` repositories, their worktrees,
board, state/cache, prompt roster and zmx namespace. It clears inherited session,
BB and runtime selectors; sets XDG_STATE_HOME, PI_BOARD_DIR, PI_CODING_AGENT_DIR,
ZMX_DIR, MISE_TRUSTED_CONFIG_PATHS and explicit PI_THREAD_RUNTIME=zmx; and uses
this checkout's Tracker CLI. Readiness is completed setup plus a registered shell
launch, not merely a running process. Fixtures clean their exact owned workers,
processes and directories before returning. Reproduction needs no ignored state
or resident deployment. Persona: fixture Git identity and explicit fixture tracker
author; no authentication. Seed: root spec, a/b tickets and outside dependency,
or root/baseline/provisional children for refinement modes.

## Mode surfaces and transient measurements

| Mode / command suffix | Action and required observation | Detailed packet |
| --- | --- | --- |
| `sparse` | Actual newThread/collector excludes issues before setup; CLI still reads global contract. Change global rulings at fixed worker HEAD, inspect handler and successor/setup prompts plus drive:none. Forbidden tracker edit refuses without changing heads or retiring writer; code-only edit lands. | [Runtime](runtime.md) |
| `collector` | Land a, observe b's single actual launch/base with a code; hold root review. Canonical a/b remain ticket with pending-landing claims, outside stays blocked. Release root: own results/evidence close, outside becomes frontier. | [Ledger](ledger.md#collector-held) |
| `restart` | Save observed a ledger/retirement and b identity after one gate; restart actual run. Same b and saved a result, no a reintegration; final three gates/nine phases. | [Ledger](ledger.md#restart-held) |
| `close-replay` | Seed delivered and prepared receipts separately, with a closed and b/root pending. Actual run closes child-first, transfers pending ledger and retires saved worker, with zero launches/gates. | [Ledger](ledger.md#close-replay-held-two-deterministic-cuts) |
| `linked-owner` | Collector/restart story with linked owner, restarting from main. Persisted cwd and all ledger destinations remain linked owner; main lacks code, global results visible from main. | [Ledger](ledger.md#linked-owner-held) |
| `failed` | Create x/y under exact attempt claim, then fail. Stop writer, remove owned children in graph-safe order, restore omitted root stage; retain baseline/friction/foreign-claimed work, zero dependent dispatch. | [Refinement](refinement.md#failed--held) |
| `replaced` | Crash at saved boundary then create another old-token child. Unadopted retry discovers/removes it and x/y before new writer; explicit stop also cleans replacement children. | [Refinement](refinement.md#replaced--held) |
| `adopted` | Explicit retry adopts through interrupted claim transfer. Recover successor, land stubs, convert to run reservation; x/y each launch once, old writer stopped. | [Refinement](refinement.md#adopted--held) |
| `accept-replay` | Interrupt after stubs landed/first reservation converted. Restart from saved consumed report; finish conversion/acceptance without second merge, each child launches once. | [Refinement](refinement.md#accept-replay--held) |

The child packets retain their independent driver predictions and review replays.
The combined revision's selected observations below come from this entry point,
not from treating helper-probe success as activation.

## Combined first use: all held

Tested revision **96491690279f2731af9686adaca6bc1610c4afbf**, based on
`36a2f664a5ce77e4e921f5036d39e4b13105a8a2`. On 2026-10-12, the exact `all`
command above was opened from `/tmp`, exited 0 in **7m51s**, and reported all nine
modes held (ten private targets, including both close-replay cuts). No production
code changed in this residual; the next commit records these measurements only.

| Mode | Selected observed transient → final result |
| --- | --- |
| sparse | Owned `/private/tmp/rc-global-sparse-9uTo2N/repo`: worker/collector had no issues, retained attachments, and canonical CLI read succeeded after setup. Handler read ruling one; successor prompt/setup read ruling two and skipped drive, while worker HEAD stayed `b462237ca64a96cff78d235e561d3aa7b85a18ce`. Both predecessor and collector ancestry held. Forbidden edit retained source `5e3a7c25bf4aca04c7f7c4c5285f593575d4c984`, destination `e14fd0f54960431c5db787278f235926e0455019`, and live worker. Code-only landing reached `24479fa6e6b89b2d578934a2f6f8534d895bfcc0` and retired its worker. |
| collector | Owned `/private/tmp/rc-global-ledger-YZUEAq/repo`. At held root review, a/b were canonical ticket, not done/frontier, each claimed `landed in root (awaiting target)`; outside retained blocker a, no frontier. Ledger a was into root at `08b7679057bf8b1004ce99c6993a6cd6c01725c5` (14:29:17.603Z), b at `a643be88fe690a457d6b152aa7bb8d7a338cb95d` (14:29:45.731Z). Single b launch `b-implement-4`, thread `6b4fcda7-f6ae-474f-b517-5da79b7be615`, had a's exact head as its recorded initial base and read `a code`. After release all ledger entries targeted owner at `23699c0921bf0c3e3a834e7d37e0cd82fc55809c`, a/b/root closed, outside frontier; three gates/nine phases. |
| restart | Owned `/private/tmp/rc-global-ledger-vF7yaq/repo`: durable cut a into root at `49c26212756e2e9a7c3d33d6c59749acd493925c`, retired `a-review-3`, one gate and saved own result. Actual restart kept b handle `b-implement-4` / thread `edd90a63-1369-464c-a797-0b5e37122fe3`, same a result, no a chain or new gate. Final three gates/nine phases, all owner-targeted/closed, outside frontier. |
| close-replay | Delivered `/private/tmp/rc-global-ledger-K3Jcvb/repo`: ledger already targeted owner, code receipt `61b2fc29dfe404162796cc2191dfaf3325bca818`, a closed, b/root pending. Prepared `/private/tmp/rc-global-ledger-kVXyhr/repo`: prepared `80eb172123aa76d9ad82608efc4dbe844bf88e87` already in owner, b still into root and root ledger absent. Each actual run recovered to done with zero launches/gates; canonical history read close a → close b → close root. Prepared recovery transferred b/root to owner with containing head `4e8dd26dfa9f01118dbbdd105b055898436f2abc`; no second integration. |
| linked-owner | Owned `/private/tmp/rc-global-ledger-BDLQ57/linked-owner` on owned; collector ab-parent was owned, not main. Restart invoked from main retained persisted cwd and b thread `c55dd132-63f1-48d6-8c00-486cb69ed98d` with a's base `d0ec5a440c2bc26c6b7eaa1d4f484e8b08c68c67`. At pause a/b open and outside blocked. Final a/b/root ledger all targeted linked owner at `f609f0ed3619bf2dbb8009cb7b59c47c0fa99b2c`, all three code files present there and absent from main; results visible from main, outside frontier, three gates/nine phases. |
| failed | Owned `/private/tmp/rc-global-refinement-2Onle2/repo`: original baseline root/baseline; x/y created with `reconcile:root/root-refine-1`. Before x/y/changed → after root/baseline/friction/outside/changed; root spec restored, exact writer stopped before cleanup, zero dependent launches. Foreign-claimed changed survived. |
| replaced | Owned `/private/tmp/rc-global-refinement-p8bcXf/repo`: crash-adjacent creation absent from saved owned list was rediscovered with x/y. Removal interrupted after y publication; retry stopped old writer, removed owned residue, began `root-refine-3` with clean root/baseline baseline. Explicit stop cleaned replacement children; baseline/friction/outside/changed remained. |
| adopted | Owned `/private/tmp/rc-global-refinement-thME3E/repo`: successor `root-refine-2` relationship saved before release; interrupted transfer left x with successor token and y with predecessor token. Recovery preserved x/y identities, landed prepared stub `de484edab9c3300d7b1460c2e6f8e99e0947ca79`, converted to `reconcile:root`; x/y launched once each, y read x code, no restart resurrection. |
| accept-replay | Owned `/private/tmp/rc-global-refinement-PDUjBG/repo`: saved consumed report with prepared/landed `9f8b7559b5ee5029cc58651cea6d57db48ea8108`, x converted, y pending. Restart left collector HEAD exactly that head, no second merge; final run reservations and one launch each for x/y. |

For every ledger mode, saved and global results retained the distinct summaries
`a reviewed result`, `b reviewed result`, `root reviewed result` and each own
`docs/attachments/fixture/<slug>.md` evidence locator; root used its join result.
The fixture asserts full saved a handoff equality across restart, not only a
summary match. The ten exact temporary roots above were independently checked
absent after completion; all four recorded refinement writer PIDs were absent.
No browser, server, tunnel, deployment or paid worker remains.

### Existing checks and two-minute repairs

At the same tested revision:

```sh
bun test lib/reconcile lib/dispatch.test.ts lib/thread skills/enabled/all/mlegls/conventions/tracker/scripts
bunx tsc --noEmit
```

**56 passed, 0 failed, 917 assertions across 16 files**; typecheck clean.
No full suite or new retained tests were added by this residual.
Unknown-mode first use exited 2 without launching any fixture.

Separate repair commits:
- `0a714b5`: removed inherited scratch-rehearsal hook bypass in ledger.ts and
  landing-probe.ts. Combined ledger modes passed with ordinary hooks; the existing
  landing probe also passed from `/tmp` (24 saves, successful cleanup receipts,
  conflict/refusal/gate cases intact).
- `8a6550c`: moved sparse runtime imports after environment/roster isolation
  (`agents.ts` caches PI_AGENTS_DIR on import) and cleared inherited identities
  before importing. First use from `/tmp` with deliberately invalid inherited
  PI_AGENTS_DIR and inherited session/parent selectors passed all four sparse
  outcomes; its exact temporary root was independently confirmed removed.

No unresolved tooling friction or runtime seam mismatch was encountered.

## Protocol probes (optional, not replacements for actual run)

- [Scheduling projection](projection.md) / [projection-probe.ts](projection-probe.ts): exact-collector satisfaction, remaining lifecycle recomputation and canonical isolation.
- [Landing protocol](landing-protocol.md) / [landing-probe.ts](landing-probe.ts): reviewed results, owner-only close, write-ahead ancestry, merge/save/close recovery and conflict/gate ordering.
- [Refinement protocol](refinement-protocol.md) / [refinement-probe.ts](refinement-probe.ts): baseline/claim authority, stop-before-cleanup, adoption, acceptance and interruption recovery.

Run a probe from any cwd with `bun "$CHECKOUT/docs/attachments/reconcile-with-global-tracker-and-landing-ledger/<probe-file>.ts"`.

## Deliberately changed assertions and cutover boundary

`lib/reconcile/refresh.test.ts` now uses current global Tracker rulings rather
than propagating branch issue blobs; predecessor/collector code ancestry and
fresh-before-setup remain. `lib/dispatch.test.ts` replaces appended-tracker union
with refusal before mutation and after preparation; appendUnion-only declaration
assertions were removed with the deleted mechanism. Tracker `issues.test.ts`
replaces branch-local done scanning with pending ledger claims. Ordinary code
conflict abort/cleanup, dependency-before-gate ordering, retry budgets and stop
cleanup remain. Five protocol tests were separately approved by the supervisor
and integrated by the activation child; this residual adds no retained tests.

Do not hot-swap the live pre-ledger campaign. Missing ledger state is a **manual
rebuild**, not an empty-ledger default or branch-blob migration. The owner checkout
is persisted State.cwd, not necessarily canonical main.
