---
stage: "done"
assignee: "agent"
author: "session:01a13a17-ba44-7373-87c5-ca7eff662862"
---
Done: `bun test` no longer waits for real retry backoff. `lib/reconcile/retry.test.ts` (its trial lives in `docs/attachments/worker-setup-failure-after-admission-escapes-launch-retry/fixture.ts`) runs in well under 30 s instead of ~43 s and still asserts the same retry counts and escalation. Production backoff is unchanged.

Cause (2026-10-14): `lib/retry.ts` has `networkRetryDelay = (attempt) => 15_000 * (attempt + 1)`, and `pendingSetup` in `lib/thread/setup.ts` sleeps that between worker-setup network retries, so the trial's setup half really waits ≥15 s. The restored fake-bb suites made the full `bun test` ~142 s (see [[projects/mlegls-pi/issues/delete-the-zmx-thread-runtime]]).

Shape: let the delay be overridden for tests, e.g. an env var read by `networkRetryDelay` (`PI_NETWORK_RETRY_MS`, set by the fixture) or an injected delay parameter on `pendingSetup`; prefer whichever touches fewer call sites. Check the provider-retry half of the trial for other real waits and shorten those the same way. While there, report any other single test over ~10 s in `bun test` (don't fix them unless it's the same knob).

## Result

done — I found nothing to repair in the diff, and both stories hold on my final head. I changed no code and added no commits.

- **Time:** `bun test lib/reconcile/retry.test.ts` passes in 10.66s runner time, and `bun run typecheck` is clean. The driver measured 20.80s on the same trial earlier, so the run time varies.
- **Production backoff:** `lib/retry.ts` still gives 15 s × (attempt+1) when `PI_NETWORK_RETRY_MS` is unset or invalid. Reconciler polling still defaults to 5 s. Only the fixture sets the overrides (`PI_NETWORK_RETRY_MS=0`, `PI_RECONCILE_TICK_MS=100`), and it restores the environment afterwards.
- **Assertions:** the diff touches only the fixture's env line, not any test assertion. The output shows the same retry and escalation outcomes: one generic provider retry with no owner mail, escalation on the second generic error and on the auth error.
- **Frictions:** the host-load timeout friction is already recorded in `docs/issues/host-load-times-out-existing-regressions.md`, with the lifecycle test passing when rerun on its own. Nothing else needed filing.

I did not run the full suite. The driver's full run (224 tests, 213.89s) had a single 5 s timeout in `lib/thread/lifecycle.test.ts` that passed on an isolated rerun. The ticket's other over-10 s tests (landing, refinement and tracker issues tests) are listed in the packet and use none of the retry knobs, so I left them alone.

The branch also carries two issue files this ticket doesn't own: `docs/issues/github-issues-as-a-tracker-backend.md` (new decisions) and `docs/issues/scratch-pr-rehearsal-transport-interruption.md` (new). They came in from other sessions' tracker writes and are unrelated to this change.

```yaml
commit: b3ef44a9
stories:
  - story: Retry trial finishes well under 30 seconds with retry/escalation checks passing
    outcome: held
  - story: Production backoff and assertion text remain unchanged
    outcome: held
evidence:
  path: docs/attachments/retry-tests-wait-for-real-backoff/index.md
  visual: false
  shots: []
tests:
  - lib/reconcile/retry.test.ts
caveats:
  - "Cost of the speed-up: the fixture trades the real 15 s backoff and 5 s polling for env overrides, so the trial no longer exercises real delays. The trial now takes ~10-20 s instead of ~43 s."
  - "Full-suite lifecycle timeout is host load, already tracked in host-load-times-out-existing-regressions."
```

Evidence: [docs/attachments/retry-tests-wait-for-real-backoff/index.md](docs/attachments/retry-tests-wait-for-real-backoff/index.md)
