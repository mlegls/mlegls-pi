# Moving out a closed node

Use the local [setup fixture](../../../lib/reconcile/setup-fixture.ts) from the candidate checkout. It runs the real reconciler with a disposable Git/vault tracker and fake BB; the run owner is `thr_solo`, with no credentials or model calls.

```sh
bun lib/reconcile/setup-fixture.ts new
```

Wait for `Ready. Retained target:` and set `ROOT` to the printed `/tmp/rc-setup-*` path. The fixture starts `solo` at `ticket` with an active implement worker. Close the tracker issue outside the run:

```sh
TRACKER="$PWD/skills/enabled/all/mlegls/conventions/tracker/scripts/issues.ts"
(cd "$ROOT/repo" && TRACKER_NO_INFLIGHT=1 bun "$TRACKER" update solo --fields '{"stage":"done","claimed-by":"reconcile:solo"}')
bun lib/reconcile/setup-fixture.ts issue "$ROOT"
git -C "$ROOT/repo" rev-parse HEAD
bun lib/reconcile/setup-fixture.ts status "$ROOT"
```

Once status shows `closed outside the run while its chain runs`, resolve it as the run owner:

```sh
bun lib/reconcile/main.ts resolve solo solo '{"action":"move-out"}' --cwd "$ROOT/repo"
bun lib/reconcile/setup-fixture.ts status "$ROOT"
bun lib/reconcile/setup-fixture.ts issue "$ROOT"
git -C "$ROOT/repo" rev-parse HEAD
git -C "$ROOT/repo" worktree list
bun -e 'import {open} from "./lib/reconcile/setup-fixture.ts"; const f = open(process.argv[1]); console.log(f.bb.threads().filter(t => t.title.startsWith("solo/")).map(t => ({title: t.title, status: t.status, archived: !!t.archivedAt})))' "$ROOT"
```

Allow a tick for `resolved solo: move-out`. At `1498737b`, the owner received `retired workers for solo; the closed issue is unchanged`. The chain and exception were gone, the fake BB worker was idle and archived, and its worktree was removed. The issue still showed `stage: done`, `assignee: agent:implementr`, and `claimed-by: reconcile:solo`; the tracker checkout's HEAD stayed at the external closure commit.

Clean up the disposable target:

```sh
bun lib/reconcile/setup-fixture.ts stop "$ROOT"
```
