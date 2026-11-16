# Independent operator drive

Revision: 47daa195e6b8183f939cdb7098e04f47df5118a6. Persona: supervision operator without authentication. Nonvisual CLI journey; no source, tests or fixtures inspected.

## Predictions before first use

From the ticket and operator setup documentation:

1. A null setup should retain the original implementer, increment the setup repair count and explain missing setup, with no driver launched.
2. A test-only entry should retain that implementer, increment the count again and explain that tests are insufficient, with no driver launched.
3. A public CLI entry should launch a driver and carry the setup into its first prompt. A fresh browser-entry target should do likewise.
4. `new --no-drive` followed by null should reach review without setup repair or a driver.

Setup will use this worktree's `bun lib/reconcile/setup-fixture.ts new`, creating an explicitly owned retained temporary repository with idle fake BB workers. This is the documented offline operator surface, launches no models and requires no inherited deployment selectors. Readiness is the command's implement-thread-ready result. Each target will be stopped with its documented stop command.

## Encounter

All four predictions met on 2026-11-17. Each `new` completed successfully in about two seconds and printed Ready with an implement thread and empty exceptions.

- Owned target `/tmp/rc-setup-Di88XR`: reported `null`, then observed `phase: implement`, `retries.setup: 1`, only the original `solo/solo-implement-1` worker and owner thread. The implementer received `Your setup is missing` and a request for public entry/setup/readiness/cleanup.
- On that same target, reported `{"entry":"bun test lib/mail.test.ts","cleanup":"bun cleanup.ts"}`. Observed the same implementer, setup count 2, no driver, and a second tell beginning `Your setup names only test-runner commands`. A supporting cleanup command did not mask the test-only entry.
- Reported `{"entry":"bun app.ts"}` there. Observed `phase: drive`, new `solo/solo-drive-2`, and the exact entry JSON under `Setup handoff from the implementer` in its initial prompt; exceptions empty.
- Fresh owned target `/tmp/rc-setup-oQf99L`: reported `{"entry":"https://fixture.invalid/board"}`. Observed drive phase, `solo/solo-drive-2`, exact browser-entry JSON in its prompt, no setup repair and empty exceptions. This checks handoff routing, not the URL's availability; no browser was opened.
- Fresh owned target `/tmp/rc-setup-PSON9Q`, created with `new --no-drive`: reported null. Observed review phase with `solo/solo-review-2`, no drive worker, no setup repair, and an explicit skipped-drive explanation in the review prompt; exceptions empty.

## Expectations, frictions and replayable checks

All predictions above were met. The documented asynchronous behavior was also met: `report` initially returned the previous state, and a subsequent `status` showed the transition. This added one status invocation per report; the docs explicitly explain it, so there is no unresolved tooling friction.

Replay using the commands in [Operator setup](index.md#operator-setup), waiting for the expected count/phase before the next report. Acceptance checks: null gives count 1 and missing-setup tell without a drive; test-only plus cleanup gives count 2 and test-only tell without a drive; CLI entry gives drive with its exact setup in the first prompt. On fresh targets, browser entry gives the same routing, and `new --no-drive` plus null gives review with neither setup repair nor drive. These checks inspect operator-visible status and worker prompts, without opening implementation or running tests.

Scope: offline real reconciler lifecycle with idle fake BB workers, as supplied by the committed operator recipe. Live model dispatch and the payload entry commands themselves were not exercised; the changed claim is the routing gate.

Cleanup: invoked the documented stop command for all three owned temporary targets; all three stop commands exited successfully, and subsequent filesystem checks confirmed all three targets absent.
