# Setup handoff gate

The reconciler now sends missing or test-only setup back to the same implementer before launching a driver. It uses the existing two-round repair budget. `drive: none` and owner skips still bypass drive. Explicit entry fields take precedence over supporting commands, so a cleanup command does not turn a test-runner entry into a user surface.

## Operator setup

Required: this checkout's installed dependencies, Bun, Git and mise on PATH. Persona: supervision operator; no credentials. The committed offline operator target runs the real reconciler, tracker and worktree lifecycle against fake BB threads that stay idle. It launches no models and touches no live BB project. The reported entry strings are handoff payloads being checked; the fixture does not execute them.

From the checkout:

```sh
bun lib/reconcile/setup-fixture.ts new
```

This prints a fresh owned `/tmp/rc-setup-*` target and waits until its implement thread is ready. It retains the target until explicitly stopped. Use its printed root as `ROOT` below:

```sh
bun lib/reconcile/setup-fixture.ts report ROOT 'null'
bun lib/reconcile/setup-fixture.ts status ROOT
bun lib/reconcile/setup-fixture.ts report ROOT '{"entry":"bun test lib/mail.test.ts","cleanup":"bun cleanup.ts"}'
bun lib/reconcile/setup-fixture.ts status ROOT
bun lib/reconcile/setup-fixture.ts report ROOT '{"entry":"bun app.ts"}'
bun lib/reconcile/setup-fixture.ts status ROOT
bun lib/reconcile/setup-fixture.ts stop ROOT
```

Reporting posts a worker turn; `status` observes it asynchronously. Wait for the new repair tell/count before posting the next report. Null and test-only reports should keep the original implementer, increment `retries.setup` and add a repair tell without a drive thread. The public CLI payload should produce a drive thread with the setup in its first prompt. A fresh target can instead receive `{"entry":"https://fixture.invalid/board"}` to exercise a browser entry. Start with `new --no-drive`, then post null, to observe review without a drive or setup repair. `stop` terminates the reconciler, retires its fake threads/worktrees and removes the owned target.

## Independent drive

[Operator encounter, predictions and replayable checks](drive.md).

## Implementation trial

On 2026-11-17, opened the command above and observed readiness at `/tmp/rc-setup-RRP7gN`. Posted null: `solo/solo-implement-1` stayed in implement, setup repair count 1 and a missing-setup repair tell. Posted `"bun test lib/mail.test.ts"`: same thread, count 2 and a test-only repair tell; no drive thread. Posted `{"entry":"bun app.ts"}`: phase became drive, `solo/solo-drive-2` received that entry in its first prompt, exceptions stayed empty. Stopped and removed this target afterward.

Regression command: `bun test lib/reconcile/setup.test.ts lib/reconcile/checks.test.ts lib/reconcile/unreadable-log.test.ts lib/reconcile/rate-limit.test.ts` — 9 passed, 74 assertions. The ticket-approved setup regression covers null/test-only repair, no driver launch, CLI/browser drive launch and `drive: none`. Existing log-recovery fixtures now supply setup so they continue reaching their intended drive phase. `bun run typecheck` passed.
