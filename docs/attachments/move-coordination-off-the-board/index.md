# First-use verification — move coordination off the board

Tested revision: eebff09621124e3a608ac973b0bd9a0cff35b978 (verification-only commits afterward).

Persona: supervisor using CLI in worker-owned checkout. `mise run setup` succeeded, installing dependencies. Initial null setup handoff had no live-run seed. Supervisor subsequently authorized a disposable /tmp repository, budget 1 and local landing; [live encounter](live.md) records predictions, setup, actions and identifiers. No source, diffs, tests or fixtures read. No rendered UI.

## Predictions recorded before use

1. Queued mail/follow-ups address bb thread IDs, without mailbox registration.
2. Reconcile consumes completed bb turns, delivers constraints and tells its owner about completion/exceptions.
3. Decisions/supervisor discovery use desk files, not subscriptions.
4. Session recall needs no board messages; instructions no longer mention mailboxes.
5. One live reconcile completes through bb. Tests/typecheck are implementation/review gates, not this non-test-only drive.

## Results so far

- Held: real worker bb report was read, constraint delivery appeared in worker bb history and was acknowledged, and the chain advanced implement → drive → review. The owner received `[reconcile hello-bb-drive] started (budget 1)` as a queued message.
- Pending: final local landing and completion tell.
- Failed expectation: newly launched worker instructions still direct board decision posts/reads. Filed [scratch-reconcile-worker-retains-board-instructions](../../issues/scratch-reconcile-worker-retains-board-instructions.md). Installed template selection may be responsible; cause not inspected.
- Unobservable: desk supervisor fallback, removed role scopes, recall without board messages, and deleted extension hooks. Scratch target had no desk roles; inherited running tools are not proof of this revision's loaded session surface. These require reviewer-owned observation before acceptance.
- CLI discovery friction: `--help` throws an internal stack trace; no-argument invocation prints usage. [Details](cli-encounter.md), [issue](../../issues/reconcile-cli-help-rejects-help.md).

## Replayable checks

- Repeat live seed and absolute CLI commands in [live encounter](live.md); accept completed HELLO.md landing, worker constraint marker in bb history, and run-complete tell to owner.
- Launch a checkout-loaded worker without a local agents roster; inspect its initial bb prompt. Accept no board_send/board_read/decision-subscription directions.
- With disposable owner unavailable, prepare an owned desk supervisor role and observe fallback notification to its bb thread. Do not mutate shared roles.
- Invoke recall in a checkout-loaded session; accept returned session context without board mailbox reads.

## Expectations and cleanup

Initial setup expectation not met; resolved through supervisor-authorized scratch preparation. bb report and constraint expectations met. Board-free instructions expectation not met. End-to-end completion and scratch cleanup pending.
