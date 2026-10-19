# Worker identity first-use verification

## Predictions before opening the product

Ticket and `docs/dispatch.md`, tested revision `989d8fc4d56f42393a3b159dda201d07a08d4172`:

1. Lookup will identify workers by bb thread id, run and handle without an ab registry.
2. A worker titled `<run>/<handle>` will be recoverable after an interrupted spawn omitted it from run state.
3. Reconciler notices will identify their owning workers.
4. Session metadata and graph descriptions will omit removed view-only fields.
5. Restarting a reconciler will reattach live workers, not duplicate them.

Expected actions: launch an isolated worker, inspect identity, interrupt/restart an owned reconciler, observe recovery and notices, then retire the worker. No shared reconciler will be mutated. `bun test` is an implementation gate, not this non-test-only ticket's user journey; this driver did not run it.

## Setup and encounter

Deployment: local worker checkout `/Users/mlegls/dev/mlegls-pi__worktrees/key-workers-by-bb-thread-id-drive-5`. Parent reports `mise run setup` completed. Implementer handoff: literal `null`. Persona: orchestration user; no authentication needed for help. No isolated run/state seed or metadata/graph invocation was supplied.

After recording the predictions, ran the documented checkout entry point `bun lib/reconcile/main.ts --help`. It exited 0 and printed `start|run <issue> --owner <thread> ... | stop <issue> | status | resolve ... | constrain ...`. This establishes CLI readiness only. It does not provide an isolated recovery seed or a safe way to reproduce missing run state. The live execution subtree is already reconciling; restarting that shared reconciler would not be a checkout-owned experiment.

No worker, server, process, browser or deployment was started. No source, diff, tests or fixtures were read. The help entry point reached command usage, not the ticket's recovery surface.

## Outcomes and expectations

All five predictions remain **unobservable**, not disproved. Neither help output nor a count of existing threads would establish recovery or the metadata/notice changes. The suite-pass requirement is also unobserved here and belongs to the implementer/reviewer gate.

Expectation that setup would supply an owned runnable recovery scenario: **not met**. Setup installation completion alone supplies no scenario. Other predictions: **not observed**.

## Replayable checks required

- In an isolated run, launch a worker; inspect public identity. Accept bb id, run and handle matching the launch, without registry setup.
- Arrange an interrupted spawn before state persistence using an authorized setup recipe; restart only its owned reconciler. Accept the original bb id recovered by title and no duplicate worker.
- Restart an isolated mid-run reconciler with a live worker. Accept reattachment to the same bb id and continued report delivery.
- Exercise an owned worker notice; accept correct reconciler ownership filtering.
- Invoke session metadata and graph public surfaces for that worker; accept absence of `seenAt`, `interactive`, `attention`, `terminals`, `delta` and a usable worker description.

These checks are specifications for replay, not executed checks. Missing: a checkout-owned seed/launch/restart recipe and public metadata/graph entry points. No credentials were inferred missing.

## Friction and owner

Null setup handoff prevents a non-implementation-aware user from safely reaching crash recovery. Recorded on the existing supervision-handoff owner: [supervised-study-drive-lacks-setup-handoff](../../issues/supervised-study-drive-lacks-setup-handoff.md). This is a setup failure, not evidence of a product failure.

Visual: false; screenshots: none.
