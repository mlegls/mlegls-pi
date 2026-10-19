# First-use verification — move coordination off the board

Revision: eebff09621124e3a608ac973b0bd9a0cff35b978.
Persona: supervisor using the CLI in this worker-owned checkout.
Setup: `mise run setup` completed (dependency installation only). bb is responding; current thread thr_jkk65mgx3y, parent thr_s276cmsmq4. No setup handoff, disposable execution issue, or seeded worker was supplied. No existing reconciler is authorized for mutation.

## Predictions (before using the changed surface)

1. Mail and follow-ups should address bb thread IDs with queued delivery; no mailbox registration should be necessary.
2. A live reconcile should consume a worker's completed turn, deliver constraints through bb, and tell this owner about exceptions and completion.
3. Shared decisions and supervisor discovery should use desk files rather than board subscriptions.
4. Session recall should not need board messages; user instructions should not tell me to use mailboxes.
5. A live reconcile should complete through bb in this checkout. Tests/typechecking belong to implementation/review, not this non-test-only first-use pass.

## Encounter log

- Read README, docs/dispatch.md and docs/session-preparation.md, not source/tests/diffs.
- `bb status` succeeds and identifies this worker thread. Setup log records successful dependency installs, not a prepared live execution.
- docs/dispatch.md supplies `bun lib/reconcile/main.ts start <issue> --owner <bb thread id>` as the public CLI. It says the run integrates work and closes global issues. No safe disposable issue was supplied, so starting this ticket would recursively execute the active assignment rather than verify it in isolation.
- `desk/` is absent in this checkout; no supervisor role has been prepared. This alone does not prove a product failure because desk state may be created during use.

## Status

Mail, worker completion/constraints/owner notifications, supervisor fallback and board-free recall remain unobservable pending an owned disposable run. No rendered UI or screenshots. No servers or background processes started.

## Expectations and replayable checks

- Expectation: the setup handoff provides a safe live-reconcile target. Not met: handoff is null and setup installs dependencies only.
- Check: provide a disposable agent-ready issue with harmless committed work and authorize local landing in this checkout; start the documented CLI with this thread as owner. Accept only after worker completes, constraint delivery is visible in worker bb history, and owner receives completion without board usage.
- Check: exercise supervisor fallback with an owned desk role and unavailable disposable owner. Accept notification to the role's bb thread, without changing shared live roles.
- Check: invoke session recall through a checkout-loaded session and observe returned session context without any board mailbox dependency.

## Next setup needed

A disposable live-reconcile issue/seed, authorized landing target and reproducible checkout-loaded session entry point. Generic installed tools in this session still advertise board namespaces; they cannot establish this revision's runtime behavior.
