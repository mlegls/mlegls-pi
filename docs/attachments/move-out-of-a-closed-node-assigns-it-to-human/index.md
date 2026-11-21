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

# Independent drive

## Predictions before first use

As the run owner, I expect an externally closed ticket with an active worker to show the closed-outside-the-run exception. I’ll resolve it with `move-out`. I expect the node to leave the run and its worker to be retired. The tracker ticket should remain closed with its original assignee and otherwise unchanged; there is nothing to put on the human queue.

## Drive

Tested `54abd1df5956f502f2c6569e37fe2caf2d0eb35d` through the CLI as fixture run owner `thr_solo`. The disposable offline fixture printed `Ready` with `solo-implement-1` active in implement. No credentials or model calls were needed.

1. Run `bun lib/reconcile/setup-fixture.ts new` from the candidate checkout and set `ROOT` to the printed directory. From `$ROOT/repo`, run `bun /home/mlegls/.pi/agent/skills/tracker/scripts/issues.ts close solo --summary 'Closed by the tracker operator.'`.
2. Run `bun lib/reconcile/setup-fixture.ts status "$ROOT"` until it shows `closed outside the run while its chain runs` for `solo` and names the active worker. **Met.** The exception told the owner how to move out. Save the output of `bun lib/reconcile/setup-fixture.ts issue "$ROOT"` and record the disposable repo’s HEAD and working-tree status.
3. Run `bun lib/reconcile/main.ts resolve solo solo '{"action":"move-out"}' --cwd "$ROOT/repo"`. Recheck status. **Met.** It logged `resolved solo: move-out`, had no remaining exception or active phase, and finished. The owner received `retired workers for solo; the closed issue is unchanged`. `git -C "$ROOT/repo" worktree list` showed only the fixture’s main checkout.
4. Compare the issue output and repo state before and after. **Met.** Issue output was identical: `stage: done`, `assignee: agent:implementr`, with the same closure result. The repo remained clean at the external closure commit `8b117cd`.
5. Stop the fixture with `bun lib/reconcile/setup-fixture.ts stop "$ROOT"`. It exited successfully.

## Friction

I expected the final owner message to describe how the run ended. **Not met.** After the accurate retirement notice, the owner received `done: solo landed in the owner's checkout at 8b117cd`, which was already HEAD before move-out. [Follow-up](../../issues/move-out-of-only-closed-node-announces-landing.md): replay steps 1–4 and check that the completion notice reports retirement without claiming a new landing.

