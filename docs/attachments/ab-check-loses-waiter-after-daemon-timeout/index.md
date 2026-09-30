# First-use drive: check waiter after daemon timeout

## Before first use — predictions

From the ticket and setup handoff only, using the checkout-local CLI with empty isolated `AB_STATE`, no authentication or seed:

1. `bun ab/main.ts check -- /bin/echo ready` should finish, show `ready`, and return 0. This establishes readiness, not the timeout story.
2. With a running check and a queued check, pausing the isolated daemon beyond its five-second request timeout but below the thirty-second caller lease should produce a temporary timeout/recovery indication while the callers remain connected. Once resumed, both commands should finish without a second submission. Their original receipts should not say `no waiting callers` or show cancellation.
3. A queued command with a distinctive output and nonzero exit code should execute once, print that output once, and return its own exit code after recovery. Listing should contain only the originally submitted executions.
4. If the connected caller intentionally departs (SIGINT), it should return 130 and release ownership: the receipt should indicate `no waiting callers`. This must not require stopping the shared daemon.

I expect `ab check list`/receipt inspection to expose execution identity and status, so I can distinguish recovery from a duplicate check. The exact CLI output format is not predicted.

## Encounter

Tested `35491d047b1c615d323c19b51f1771da20eaf106` from this worktree on 2026-09-30. Deployment: checkout-local Bun CLI, fresh temporary `AB_STATE` (`/var/folders/.../tmp.DWSGTftMlC`), `AB_CHECK_SLOT=""`, no auth or seed. The entry point was `bun ab/main.ts check -- /bin/echo ready`; the isolated daemon PID was 45373. The entry point printed `ready`, returned 0, and its receipt `9dd08883-802a-44d2-815f-4d4129efd4c6` was `done`, code 0. This established readiness before the timeout drive. No inherited state or shared daemon was used.

### Connected callers across timeout — held

From the checkout, launched two distinct connected check callers (`/bin/sh -c 'sleep 14; echo running-A'`, likewise `running-B`), then a third (`/bin/sh -c 'echo once-queued; exit 7'`). Before pausing, `bun ab/main.ts check list` showed A `885e1093-d791-45fe-a802-8f34e5959e51` and B `e8f5b866-d665-491d-a107-b0045f0108a4` as `running`, Q `fb51b87f-925e-490c-81d1-ae5a57cc83ba` as `queued`. Sent SIGSTOP to this isolated daemon for seven seconds, then SIGCONT. No check was resubmitted.

All three callers printed `<same execution ID>: daemon request timed out; retrying receipt`; A printed `running-A` and exited 0, B printed `running-B` and exited 0, Q printed `once-queued` once and exited 7. `check list` afterward contained the readiness execution plus exactly A, B, Q; all three were `done`, codes 0, 0, 7, with no cancellation reason. The queued check started when A finished (while B was still running). This meets predictions 2 and 3, including original execution identity, distinct output, and propagation of nonzero status.

### Intentional departure — held

Launched a check caller for `/bin/sh -c 'sleep 40; echo should-not-print'` (receipt `ea5698fb-1675-4698-9690-ce16defe783f`). After confirming its receipt appeared in `check list`, sent SIGSTOP to the isolated daemon for six seconds, then SIGINT to the caller and SIGCONT to the daemon. The caller printed the temporary retry notice and exited 130. `check list` showed its receipt `done`, code 143, reason `no waiting callers`; `should-not-print` did not appear in the caller output. Prediction 4 held for ownership release; the receipt's code 143 differs from the caller's 130 but was not predicted to match it.

### Expectations and frictions

- Prediction 1 met: immediate command printed `ready`, exited 0, receipt code 0.
- Prediction 2 met: timeout notice was nonterminal for connected running and queued callers; each retained its execution identity.
- Prediction 3 met: queued command output appeared once, exit 7 propagated, no duplicate execution in listing.
- Prediction 4 met: SIGINT exited 130 and receipt recorded `no waiting callers` with code 143.
- Listing expectation met: `check list` gave IDs, command, status, exit codes, and reason where applicable. The JSON includes transient state paths and timestamps; they are not needed to match the receipts.
- Friction: the notice says `retrying receipt`, but does not tell the caller how long it will retry or whether the execution is still owned while the daemon is unavailable. The caller eventually resolved in this drive; a long outage beyond the lease was not attempted.
- Friction: caller exit 130 versus receipt code 143 on intentional departure could confuse someone inspecting an interrupted command. The receipt's reason disambiguates it.
- Friction: this story needs a daemon fault; the public CLI has no user-facing way to induce one. The isolated PID pause from the setup recipe was necessary. The real daemon delay from the original incident remains unknown.

### Replayable checks suggested by this encounter (not automated here)

1. With fresh `AB_STATE`, submit two 14-second checks and a queued `/bin/sh -c 'echo once-queued; exit 7'`. Confirm listing shows the latter `queued`; pause that state's daemon PID for seven seconds, then resume. Accept only if all three original IDs remain, none has `no waiting callers`, callers terminate 0/0/7, each output appears once, and there is no extra execution. Observe the retry notice, not an exit 2.
2. With fresh `AB_STATE`, launch `/bin/sh -c 'sleep 40; echo should-not-print'` under a controllable caller process. Confirm it is listed, pause the state's daemon PID for six seconds, send SIGINT to the caller, resume daemon. Accept caller exit 130, receipt reason `no waiting callers`, and absence of `should-not-print` in output. Receipt code 143 is what this encounter observed; assert the ownership reason rather than assuming receipt code equals caller code.
3. Check the initial `bun ab/main.ts check -- /bin/echo ready` entry point against the same isolated target. Accept output `ready`, exit 0, and a single done code-0 receipt before other submissions.

CLI-only journey: no rendered UI or screenshots. The timeout mechanism is a controlled surrogate, not a reproduction of the original daemon stall; this evidence speaks to waiter recovery and departure under an injected >5-second delay, not its production cause.

## Review and automated replay — 2026-09-30

Reviewed the timeout exception, polling loop, daemon request/ensure path, and resource
lease/release lifecycle against this encounter. Recovery reuses the execution and
client; it does not submit again. Other daemon errors remain terminal.

Frictions resolved in scope:

- Retry notice now says `retrying receipt until response or interruption (30s caller lease may expire)`.
  It describes the retry policy without claiming ownership during an unobservable outage.
- `ab check --help` now distinguishes the caller's SIGINT exit 130 from the running
  command's possible SIGTERM receipt 143, and immediate release from lease expiry.
  The differing codes are preserved, not normalized.
- Fault injection remains test-only: the CLI regression below owns a fresh isolated
  daemon and reproduces the pause directly. No production fault-injection command
  is needed to replay the encounter. The underlying production delay remains unknown.

All three suggested checks are encoded in `ab/resources.test.ts`, test
`CLI retains running and queued waiters across daemon timeouts, but releases on SIGINT`.
It launches the checkout-local CLI with fresh `AB_STATE` and empty `AB_CHECK_SLOT`,
checks readiness, pauses two running checks and a queued exit-7 check for seven
seconds, then pauses an intentionally interrupted caller for six seconds. Assertions
cover original receipt IDs, no duplicates, exact output and exit codes, timeout
notice, cancellation reason, and absence of the interrupted command's output.
Cleanup resumes and shuts down only the isolated daemon and removes its temporary state.

Replay on the reviewed changes: `ab check -- bun test ab/resources.test.ts lib/resources/host.test.ts`
passed (9 tests, 77 assertions), execution `b8a57ff5-35f2-452a-85f6-50da02437f8b`.
The changed notice was observed through the real CLI and asserted by the replay.
Broader affected suite: `ab check -- bun test ./ab ./lib/resources` passed
(20 tests, 147 assertions), execution `ea3b46dd-fd4a-4a99-bacb-76eb9853ad3c`.
`git diff --check` passed. Both replays shut down their isolated daemons.

Final claim outcomes:

- Readiness: held — `ready`, exit 0, one done code-0 receipt.
- Connected running and queued callers retain ownership across timeout: held.
- Queued check executes once, preserving output and exit status: held.
- SIGINT releases ownership: held — caller 130 and receipt `no waiting callers`.
- Receipt listing exposes identity and status: held — no extra executions after recovery.

No screenshots: CLI-only. The injected delay remains a surrogate for the unestablished
production stall; outages beyond the existing thirty-second lease are not certified.
