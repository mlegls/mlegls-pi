# Implementation trial

Base: `6d75eb61f78f1b36ba2e68918b01ed1f43fc5fbb`.

## Runnable setup

Backend-only, disposable local Git repositories with fake bb threads; no model, deployment, credentials, or paid API. From this branch run:

```sh
bun test lib/reconcile/retirement.test.ts
```

The fixture owns its temporary repository, seeds a finished implementer with declared `.captures/x`, undeclared Convex state, dependency output and `.wm/processes` diagnostics, then runs the reconciler into drive. It removes its temporary target afterward. This entry point was opened successfully during implementation.

## Observations

- The finished worker's capture and Convex state survived retirement with `RETIRED.md`; disposable `node_modules` did not.
- One owner retention notice named `.captures/x` and the non-routine Convex parent, without `.wm` diagnostics or `node_modules`. The reconciler log retained the complete kept-entry list.
- A second routine-only receipt survived before its commit reached main, then was pruned after a fast-forward merge. The declared capture remained.
- A temporary, non-kept diagnostic also named a quoted `node_modules/retained data/export`: it survived disposable filtering, appeared in owner-attention metadata, and was protected from pruning.

Checks: `bun test lib/reconcile/retirement.test.ts lib/thread/lifecycle.test.ts lib/dispatch.test.ts`: 16 pass, 0 fail. `bunx tsc --noEmit`: passed. The retirement test was rerun after moving pruning into landing cleanup so the final landing also triggers it.

## Limits for the fresh driver

This is implementation first use, not independent acceptance. Host bb was not used: the fixture supplies bb output and owner-message transport while Git and filesystem retirement are real. No rendered surface is affected.

Pruning requires the new `retirement.json` receipt. Older `RETIRED.md`-only directories are preserved because their workers' handoff declarations were not recorded. Unknown/non-routine output, including `.convex`, is still retained and reported; it is not made disposable. Missing targets and unmerged patches prevent pruning.
