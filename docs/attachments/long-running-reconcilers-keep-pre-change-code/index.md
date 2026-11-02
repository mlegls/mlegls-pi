# Long-running reconciler code refresh — implementation trial

Base: f4a986c555efac4e999465a4783996f636ed14f6. Backend-only; no visual surface.

## Reproduce the starting surface

From this checkout:

`bun docs/attachments/long-running-reconcilers-keep-pre-change-code/setup.ts`

This creates an owned `/tmp/code-refresh-*` Git repository, a **copied** package, one reconciler with a live fake-bb implementer, and a paused pickup watcher. It waits for both processes' state to be ready and prints the direct status command. No credentials, real daemon or model calls; persona `thr_fixture`. Source edits in the printed `code` directory affect only this fixture. The package's dependencies and tracker scripts use the invoking checkout.

- Inspect both public CLI statuses: `bun docs/attachments/long-running-reconcilers-keep-pre-change-code/setup.ts status <root>`
- Change/add a TypeScript file under `<root>/package/lib/` or `extensions/supervision/`; wait up to one minute plus a tick.
- State/log: `<root>/repo/.git/reconcile/solo.{json,log}`, pickup `state.json` and `watcher.log` under `.git/pickup/`.
- Fake host calls and owner notices: `<root>/fake-bb/calls.log` and `thread-thr_fixture.json`.
- Stop and remove the owned fixture: `bun docs/attachments/long-running-reconcilers-keep-pre-change-code/setup.ts stop <root>`

## Observed first use

On the implementation source, fixture `/tmp/code-refresh-6yzOKS` was ready. Added `lib/refresh-probe.ts` to its copied package:

- Both public CLI statuses immediately showed the original loaded fingerprint and `stale: true`.
- At the next minute check, run PID **1123465 → 1177345**, watcher **1123551 → 1176941**; both logs said **code changed on disk; restarting**.
- Run's complete chains and exceptions were unchanged; same worker `solo-implement-1`, bb id `bbt-8910afc2`, same launch/base/retry state.
- No new thread spawn, stop, archive or tell calls; owner's notice list unchanged.
- Replacement run logged **started quietly (budget 1)**. The paused watcher preserved its scope, owner, budget and started ledger. Both statuses returned `stale: false` with the replacement fingerprint.

These are implementer diagnostics, not independent acceptance. The driver/reviewer should also exercise restart deferral during a pending landing, recovery once safe, and completed landing receipts not preventing refresh. Landing receipts are retained indefinitely: only unfinished receipts block restart, not the mere presence of historical `landingOps`.

Existing affected regressions: 11 passed across `pickup`, `resume`, `stop`, `status`, `campaigns`, and `launch-recovery` test files; typecheck passed. No new permanent test added by the implementer.

## Deployment and retired state

Processes already running code **before this change** cannot discover the new check. After landing, the owner must bootstrap those processes once (terminate their exact reconciler/watcher PIDs, **not** `reconcile_stop`, then start/resume quietly), preserving their state/workers. New status marks missing pre-notice versions stale rather than claiming they loaded current code.

The issue explicitly sequences `~/dev/mmon/concept__retired` removal **after landing**. No directories there have been removed by this worker. A read-only preliminary inventory on 2026-11-02 found 14 directories, roughly 4.3 GiB, including local Convex databases, generated output/dependencies, and `.wm`/`.lavish` captures. Inventory alone does not prove uniqueness; the post-landing owner must finish the content comparison, report unique files and then remove those directories.
