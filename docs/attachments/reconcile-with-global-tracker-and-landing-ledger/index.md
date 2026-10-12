# Global Tracker / landing ledger: combined rehearsal

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
The combined revision's selected observations and checks are recorded below after
running this entry point, rather than treating helper-probe success as activation.

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
