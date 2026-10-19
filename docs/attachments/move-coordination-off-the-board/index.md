# First-use verification — move coordination off the board

Tested revision: eebff09621124e3a608ac973b0bd9a0cff35b978 (evidence-only commits afterward). Persona: CLI supervisor. Dependency setup succeeded; supervisor subsequently authorized an isolated scratch repo and local landing. No source/diffs/tests/fixtures inspected, no tests run, no rendered UI.

## Predictions before use

1. Mail and follow-ups use bb thread IDs, no mailbox registration.
2. Reconcile consumes bb completed turns, sends constraints and tells owner when done.
3. Shared decisions and supervisor lookup use desk, not subscriptions.
4. Worker instructions and recall no longer depend on board mailboxes.
5. A live reconcile completes end to end through bb.

## Results

- **Held:** real implement → drive → review → local landing, budget 1. Worker report read from bb; constrain delivered as a bb message, acknowledged by marker, and carried through later phases. Owner received `[reconcile hello-bb-drive] done: hello-bb-drive landed in the owner's checkout at b9a6b59` after yielding for queued delivery. See [live encounter](live.md) and [final landing/cleanup](live-final.md).
- **Failed:** newly launched scratch worker instructions still direct board decision posts and reads. [Tracked friction](../../issues/scratch-reconcile-worker-retains-board-instructions.md). May be installed template selection; cause deliberately not inspected.
- **Unobservable:** desk supervisor fallback, removed role scopes, deleted board hooks/tools and board-free recall. No scratch roles were seeded and inherited tools do not establish this revision's loaded session surface. Reviewer must observe these before full acceptance.
- CLI `--help` fails with an internal stack trace; no-argument usage is a workaround. [Encounter](cli-encounter.md), [tracked friction](../../issues/reconcile-cli-help-rejects-help.md).

## Expectations

Initial live-run seed expectation not met by null setup handoff; resolved by authorized disposable setup. bb report, constraint and completion expectations met. Board-free worker instructions expectation not met. Desk fallback and recall expectations unmeasured.

## Replayable checks

- Repeat seed and CLI commands from live encounter; accept HELLO.md bytes `48 65 6c 6c 6f 20 62 62 2e 0a` on scratch main, marker in worker bb history, reconciler status done, and queued completion tell to owner after yielding.
- Launch without local agents roster; inspect initial worker bb prompt. Accept no board_send/board_read/decision-subscription directions.
- Prepare disposable unavailable owner and owned desk supervisor role; accept fallback bb tell without shared-role mutation.
- Invoke recall in a checkout-loaded session; accept session context without board mailbox reads.

## Cleanup

Stopped authorized scratch run after completion. All three child bb threads archived automatically; verified idle/archive timestamps, no remaining worker worktrees, and deleted exact scratch repository and empty worktrees directory. No servers, pages, deployments or processes remain.

## Review (reviewer, head after fad39b76)

- **Worker-instruction story: held on the branch.** The failure was environmental: workers read their preamble from AGENTS_DIR (default `~/.pi/agent/agents`, a symlink to the canonical checkout's `agents/`), which is the unmerged copy while the branch is in review. The branch's `agents/_common.md` and `agents/roles/handle.md` carry no board_send/board_read/decision text (`grep -rn board agents` empty). Takes effect on landing. Friction issue `scratch-reconcile-worker-retains-board-instructions` closed with that disposition.
- **Desk fallback: held.** In a throwaway repo (`/tmp/rv-desk.*`, deleted), `setRole('supervisor', <live thread>)` wrote `desk/ROLES.md`; `roleThread('supervisor')` returned it, a nonexistent owner is not live in `bbThreads()`, so the `tellOwner` rule in `lib/reconcile/reconcile.ts` (owner if live, else live supervisor, else owner) selects the supervisor; an unset role gives `undefined`. Shared desk untouched. The send itself (`tellBb`) is the path the live run already exercised.
- **Board-free recall: held by inspection.** `extensions/context/recall.ts` no longer mentions board; old `board` records stay readable in the shared store (documented). No board tools/hooks remain: `bunx tsc --noEmit` clean, `grep` finds board only in the records-store dir name (`PI_BOARD_DIR`, kept deliberately) and historical profile kinds.
- **CLI help:** fixed (fad39b76); `bun lib/reconcile/main.ts --help` prints usage, exit 0. Friction issue closed.
- Tests: `bun test lib extensions/supervision extensions/context extensions/bb`: 176 pass, 1 timed out under host load (`archive conflict answered checkpoint…`, 5 s) and passed on rerun of `lib/thread/lifecycle.test.ts` (12/12, 1.3 s). Project declares no `test:affected`.
