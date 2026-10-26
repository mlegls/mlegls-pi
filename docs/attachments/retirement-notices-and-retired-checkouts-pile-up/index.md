# Retirement acceptance evidence

## Drive 2 — 2026-10-26

Tested revision: `f654468fdccc13d45ffa3019af4a2aa79d3f8c56`.

Setup and pre-use predictions: [encounter log](drive-2.md). Nonvisual developer/test-runner journey; no screenshots, browser, server or external deployment was used. The ticket explicitly names a test as acceptance and the implementer supplied its runnable entry point.

### Action and observed result

From this worker's own checkout, ran:

```sh
bun test lib/reconcile/retirement.test.ts
```

Bun 1.4.4 completed in 3.42 seconds: **1 pass, 0 fail, 25 expectations**. The reported case was `finished retirement reports declared captures, keeps Convex state, and quietly prunes merged routine state`.

The runner visibly launched a drive worker and logged retirement with retained `.captures/`, `.wm/processes/` and `packages/` beneath an isolated `/tmp/rc-protocol-…/repo__retired/` target. That is a reconciler log line, not evidence of an owner notification. The acceptance case passed.

### Stories and expectations

| Claim / pre-use expectation | Outcome | Observation |
| --- | --- | --- |
| Finished retirement preserves declared captures and notifies the owner without routine-output notices | held | Supplied acceptance runner passed its declared-capture retirement case. |
| Merged routine-only retained state is pruned; declared captures remain | held | Same passing case explicitly reports quietly pruning merged routine state. |
| Routine retained output is recorded without supervisor intervention | held | Routine retention appeared in runner output; supplied acceptance case passed without intervention. |

These outcomes are acceptance-runner evidence, not independent inspection of the implementation, owner inbox or retained filesystem. No source, tests or fixtures were read, and no product repairs or new tests were made.

### Replayable checks

1. Run the command above on the tested revision. Accept exit 0 with the named retirement case passing; reject a failed assertion, setup error or missing case.
2. For review of the acceptance's coverage, confirm it exercises exactly one notice naming `.captures/x`, none for routine setup output, routine-only post-merge deletion, and declared-capture preservation. The driver did not inspect the test to independently establish its assertion coverage.

### Frictions and cleanup

No execution friction observed: supplied entry point was immediately runnable and completed successfully. No live external resources were started; the managed runner exited normally. No raw runner logs are committed. The isolated temporary target was created by the acceptance runner, not a shared checkout or deployment.

## Review

Reviewed 7b8471d8 against the ticket. `bun test lib/reconcile/retirement.test.ts lib/thread/lifecycle.test.ts`: 9 pass, 0 fail. The retirement test asserts exactly one owner notice, naming `.captures/x` and not `.wm/` or `node_modules`. After the branch merges, `pruneRetired` removes the routine-only directory and keeps the one holding `.captures/x`. No repairs needed.
