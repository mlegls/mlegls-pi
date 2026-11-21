# Worker handoff across BB turns

In the Roleplay Opening incident, BB logged the `done` message (seq 1113) and its completion (1116) under turn `daea60f86b-t3`. A standalone compaction in turn `daea60f86b-t4` then completed at 1120, before the repair request at 1122. The historical value of `bb thread output` at the poll is unknown. The event log has the report and the identity of the turn that produced it.

## First use

From this checkout, run `bun lib/reconcile/setup-fixture.ts new`. `Ready` means the real reconciler has launched the fake implement worker for the disposable `solo` ticket. No models, live BB mutation, or credentials are needed. Use the printed `/tmp/rc-setup-*` target as `ROOT` below.

````sh
bun lib/reconcile/setup-fixture.ts turn "$ROOT" 'done

```json
{"setup":{"entry":"bun app.ts"}}
```' --compact-after
bun lib/reconcile/setup-fixture.ts status "$ROOT"
````

The fixture logs the worker's report and completion, then a separate compaction turn, with thread-wide output set to empty. The immediate submission snapshot may still say `implement`. Once processed, the phase should be `drive`, the driver prompt should contain `bun app.ts`, and the implementer should have no status repair tell. The implementer observed all three on a fresh fixture.

When done, run `bun lib/reconcile/setup-fixture.ts stop "$ROOT"` to stop the reconciler and remove the disposable target.

The reader also recovered three recorded BB handoffs when the agent message was visible on one poll and completion on the next, with the second poll forced to read multiple pages. In each case it returned the original message text:

| BB thread | Agent message → completion | Status |
| --- | --- | --- |
| `thr_v5wtzb88yp` | 1113 → 1116 | `done` |
| `thr_579z45iect` | 315 → 318 | `waiting` |
| `thr_53rigwq8up` | 1672 → 1675 | `checkpoint` |
