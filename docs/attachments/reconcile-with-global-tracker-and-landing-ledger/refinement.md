# Actual-run provisional refinement rehearsal

## Setup and replay

Machinery: [refinement.ts](refinement.ts), committed at `81552b9`. Production baseline: `8648784abe2e6fbc2bc1662fc83853aa89774b7c5`. Observed 2026-10-12; this is implementer first-use evidence, not independent acceptance. No rendered surface; visual: false.

From **any cwd**, with Bun, Git, mise and zmx on PATH:

```sh
CHECKOUT=/absolute/path/to/mlegls-pi
bun "$CHECKOUT/docs/attachments/reconcile-with-global-tracker-and-landing-ledger/refinement.ts" failed
bun "$CHECKOUT/docs/attachments/reconcile-with-global-tracker-and-landing-ledger/refinement.ts" replaced
bun "$CHECKOUT/docs/attachments/reconcile-with-global-tracker-and-landing-ledger/refinement.ts" adopted
bun "$CHECKOUT/docs/attachments/reconcile-with-global-tracker-and-landing-ledger/refinement.ts" accept-replay
# Default runs all four sequentially, each in its own subprocess/private repository.
bun "$CHECKOUT/docs/attachments/reconcile-with-global-tracker-and-landing-ledger/refinement.ts"
```

Required/prepared deployment: local disposable scratch Git repository, owned solely by this fixture. The script creates a private `mkdtemp` directory and its `repo`, bin, stance/role files, board, agent/session storage and zmx namespace. No persona login, credentials, network inference or paid worker. Each used role has exactly one shell stance. Shell pi sleeps while the fixture publishes deterministic reports; production `start`/`run`, scheduler, exact-thread launch/stop, global Tracker and integrate perform the transitions. The tracker wrapper delegates every operation to the checkout-local canonical CLI; it only introduces explicit interruption cut points.

Isolation sets XDG state/cache, PI_BOARD_DIR, PI_CODING_AGENT_DIR, PI_AGENTS_DIR, ZMX_DIR, MISE_TRUSTED_CONFIG_PATHS, TRACKER_CLI, explicit `PI_THREAD_RUNTIME=zmx` and private admission state. Inherited BB/session/worker/runtime/tmux/tracker selectors are cleared **before cached runtime imports**. Seeds supply `author: session:fixture`. Prepared seed: root spec, globally done baseline child, unrelated human friction, and outside ticket depending on baseline. The root's original saved subtree is `[root, baseline]`.

Readiness was observed in all four final modes: registered shell launched (`shell-started`, exact `shell-pid`) and declared `mise run setup` completed (`setup-ready`) before reports. The exact claim token is extracted from the registered launch prompt and compared with persisted attempt state. All assertions fail nonzero. On success/failure the fixture stops its run and retires only registered threads whose project is its private repo, then removes the private directory. It starts no browser, service or deployment outside that directory. No retained tests were added.

## Final combined run

Command actually opened from `/tmp`: `bun <worker-checkout>/docs/attachments/reconcile-with-global-tracker-and-landing-ledger/refinement.ts`. Four modes passed, approximately 3m15s total. The private directories below were removed after the observations; their identifiers distinguish independent targets, not durable deployments. The assertions and commands above reproduce each transient observation. Selected receipts follow, rather than raw machine logs.

### failed — held

Target `/private/tmp/rc-global-refinement-0E2n9y/repo`; first writer `root-refine-1`, PID 60588, token `reconcile:root/root-refine-1`.

- Created x/y with exact claim and part-of in the same `Tracker.create`; y depended on x. Saved ownership contained both; no x/y implement receipt existed while writing.
- Also created `changed`, then transferred its claim to `someone-else` and detached it. Detached (but retained) the globally done baseline to exercise root's **last provisional child** removal with omitted residual stage.
- Sent blocked terminal report. Actual run stopped the exact writer, removed x/y and restored root's saved `stage: spec`.
- Before: x, y, changed. After global rows: root, baseline, friction, outside, changed. Changed retained its foreign claim; baseline remained globally done. Dependent launches: zero.

### replaced — held

Target `/private/tmp/rc-global-refinement-M7aQlC/repo`; first writer `root-refine-1`, PID 65941, token `reconcile:root/root-refine-1`.

- After observing x/y, terminated only the **exact reconciler PID** at its saved-state boundary; its registered shell writer remained alive. Created `crash-adjacent` with the old token after that saved owned list. Confirmed it was absent from the saved list.
- Queued real owner resolution `{action: "retry"}` and restarted via `start`. Cut the canonical CLI immediately after y removal published but before the following state save. Persisted phase was `cleaning`, old shell PID was dead, and discovery had recorded `[x, y, crash-adjacent]`.
- Restart replay completed cleanup. No x/y/crash-adjacent remained. New launched attempt `root-refine-3`, token `reconcile:root/root-refine-3`, fresh baseline `[root, baseline]`. Counter gaps represent durable pre-launch allocation, not extra child dispatch.
- Created fresh provisional x/y for the successor and a foreign claimed child. Explicit `stop` killed that writer and removed its provisional children while preserving baseline, friction, outside and foreign changed child. No x/y implement receipt existed.

### adopted — held

Target `/private/tmp/rc-global-refinement-kdRIk7/repo`; original writer `root-refine-1`, PID 72967.

- Real `{action: "retry", adopt: true}`. Cut immediately after x's claim transfer published, before the following save. Saved old phase `adopting`, successor `root-refine-2`, successor `adoptedFrom: root-refine-1`; old writer dead before claim transfer. At this cut x had `reconcile:root/root-refine-2`, y still `reconcile:root/root-refine-1`. Neither dispatched.
- Actual restart replay retained the same x/y identities, transferred remaining y claim, and launched that **same** saved successor, not another attempt.
- Successor committed code-only stub and reported the existing children without duplicate create. Original stub `6131f61182172820049e3014a860756667444996`; prepared/collector stub `46ffa30fe574eb923a7b0465ff8385fcfff88ee5` (integration may rebase the code commit).
- Only after stub landing did x/y hold stable `reconcile:root` claims. x launched exactly once as `x-implement-3` with base equal to prepared stub. After x's actual review/integration, y launched exactly once as `y-implement-5` at `92e46d3ad02407b4dcb9b785f1116ae0e30b7b72`, containing both stub ancestry and x code. Restart did not resurrect removed attempts or duplicate either child.

### accept-replay — held

Target `/private/tmp/rc-global-refinement-TqP0bY/repo`; original writer `root-refine-1`, PID 86155.

- First restored the same partial-adoption cut: saved old-to-successor relation before release, x transferred, y still original token. Restart completed transfer into `root-refine-2`, with no dependent launch during transfer.
- That registered successor committed its stub, then actual run integrated into the collector. Cut immediately after stable x claim conversion, before the next save. Saved phase `accepting`, prepared and landed head both `c8cdff5d72851c3155893ec9a193b9a762868a91`; x stable, y still successor token.
- Explicitly restored that saved state with `chains.root.handledTs` already set to report timestamp `2026-10-12T13:49:40.272Z`. Restart replay used the independent pending acceptance receipt despite the consumed report cursor.
- Collector HEAD before/after replay was identical (`c8cdff5d72851c3155893ec9a193b9a762868a91`): no second stub merge. Remaining y claim converted, acceptance persisted.
- x launched once as `x-implement-3`, base equal to prepared stub. Actual x review/integration released y once as `y-implement-5`, base `615332f49e1aae49891b4bdcba9aca63da7fe328`, containing x code and stub ancestry. Restart produced no duplicate child dispatch.

The interruption wrapper checks its parent PID against saved `State.pid` and verifies the exact `lib/reconcile/main.ts run root` command before SIGKILL. It never pattern-kills. Cuts are defined by saved state plus published Tracker operation/code ancestry, not guesses against timers. Readiness waits have bounded timeouts; the final additional tick wait merely checks that closed attempts stay closed.

## Repairs encountered and re-driven

- `e83b5b3`: refinement-only `{children: [...]}` report fences were ignored by the shared parser's recognized-key filter. Recognized the consumed refinement/respec seams; existing report tests still pass. This failure was observed as “Refinement handoff needs children” despite the exact children report.
- `909fd3a`, `65e0333`: restarting a partial adopting retry resumed its saved successor, then replayed the unresolved owner retry file into a second successor. Persist the retry's original refinement handle before replacement; replay recognizes its recorded successor. Targeted resolutions bind the actual target. Final adopted and acceptance replay modes hold without discarding the pending resolution or substituting helper calls.
- `fc88828`, `16053ce`, `727bd5c`: the full existing suite exposed a baseline system-prompt mock missing the already-used `getActiveTools`/`getAllTools` API. Updated that existing mock (and its partial-API typing), not assertions or product behavior. Final prompt tests: 7 pass; typecheck pass.

Regression commands: `bun test` → **226 pass, 2 skip, 0 fail**, 228 tests across 51 files. `bunx tsc --noEmit` → pass after the mock annotation repair; `bun test extensions/system-prompt/index.test.ts` → 7 pass on the final source. No tracker lifecycle expectations weakened, no new retained tests, no unresolved tooling friction. Child y is intentionally left running only until fixture cleanup: this packet tests dispatch/ownership/replay, not the enclosing collector-to-owner completion story (owned by the parallel ledger rehearsal).
