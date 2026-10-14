# Retry trial timing

Independent developer encounter: [driver packet](drive.md) (revision `9ba836be`, targeted run 20.80s; full-suite timeout reproduced as a passing isolated rerun).

Implementation check on `9ceb54f7` (2026-10-14), Bun 1.4.3. Nonvisual offline fixture; fake bb workers, temporary fixture-owned repositories/state, no daemon, model or credentials. Dependencies were prepared with `mise run setup`; typechecking passed with `bun run typecheck`.

## Reproduce

From a checkout with setup complete:

```sh
bun test lib/reconcile/retry.test.ts
```

The committed fixture creates its own seed/state, overrides network retry delay and reconciler polling only inside the trial, restores the environment and stops its workers/reconcilers before removing its temporary directory.

## Observations

- Targeted trial: **17.03s** test time (17.41s runner time), one pass. Full-suite encounter: **19.93s**. Both are below 30s.
- Network setup retried once and started (two setup invocations); non-network setup failed without retry (one invocation).
- First generic provider error replaced the worker once, recorded provider retry count 1, and sent no owner mail. Second generic error escalated to the owner; authentication error escalated without replacement. All existing assertions are unchanged.
- Direct library check with `PI_NETWORK_RETRY_MS` absent returned 15000/30000/45000ms for attempts 0/1/2; fixture override `0` returned zero for all three; invalid override fell back to the defaults. Production reconciler polling still defaults to 5000ms and error settling to 90000ms.

## Requested suite timing scan

`bun test`: 224 tests across 50 files, 221 pass, 2 skip, 1 timeout; total 213.89s. Besides this trial, these single tests exceeded 10s in this encounter (not changed; they do not use the new retry knobs):

| File | Test | Time |
| --- | --- | ---: |
| `lib/reconcile/landing.test.ts` | a rebased lockfile prepares declared deps before pre-integrate | 11.56s |
| `lib/reconcile/refinement.test.ts` | adoption saves successor ownership before claim transfer; ordinary replacement prunes only its remaining provisional children | 10.08s |
| `lib/reconcile/refinement.test.ts` | landed refinement stubs forbid discard or replacement before claim conversion; recovery needs no source checkout | 21.27s |
| `skills/enabled/all/mlegls/conventions/tracker/scripts/issues.test.ts` | format-equivalent dependencies preserve all queries | 19.53s |
| `skills/enabled/all/mlegls/conventions/tracker/scripts/issues.test.ts` | invalid frontmatter fails every query with a filename and no partial output | 13.96s |

The failure was `lib/thread/lifecycle.test.ts` / `archive conflict answered turn-end is not a resolution: node and ancestor stay active`, timing out at 5001ms. Immediate unchanged rerun with `bun test lib/thread/lifecycle.test.ts -t 'archive conflict answered turn-end'` passed in 1985ms (2.93s runner time). No assertion failure observed; host pressure/cause was not measured. Added this encounter to the existing [timeout friction owner](../../issues/host-load-times-out-existing-regressions.md).

These are implementation observations, not independent driver acceptance.
