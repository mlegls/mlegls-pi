# Relaunch after a restart: first-use replay

## Predictions before running

- `raw`: interrupt immediately after Git adds the worktree. Restart should recreate the checkout and start a worker under the same handle.
- `ahead`: restart should adopt the checkout under the same handle and preserve commits made beyond the base.
- `occupied`: restart should refuse the conflicting path, leave it intact, and tell the owner why no worker started.

## Setup and replay

Tested `42b50dbd3b5e46d130dc23b513abbe5384c306c1` with Bun from the drive checkout. The handoff uses disposable Git repositories and a fake BB run owner (`thr_owner`); it needs no login or shared deployment.

```sh
for mode in raw ahead occupied; do bun lib/reconcile/launch-recovery-fixture.ts "$mode" || exit; done
```

## Observed

All three modes exited successfully in 12 seconds total and reported `SIGKILL` followed by a new reconciler start.

| Mode | Result | Replay check |
| --- | --- | --- |
| `raw` | Met. The log reported `reclaimed interrupted setup` and then launched `root-implement-1`. | Run `raw`; expect reclaim followed by a launch and matching handle and worker fields. |
| `ahead` | Met. The log reported adoption and launched `root-implement-1`; the receipt includes `adoptedCommit` (`e9cd83bebb641f7c4d57a9a4cf58cce70a15d613` in this run). | Run `ahead`; expect adoption, an adopted commit receipt, and matching handle and worker fields. |
| `occupied` | Met for refusal. It reported `saved launch worktree needs attention → owner`, with a hold and no launch. | Run `occupied`; expect an owner hold with no worker. The visible receipt does not show a before/after listing of the conflicting path. |

No friction running the supplied command. The replay exercises one occupied-path case. It does not exercise a live BB daemon restart or show the full owner notification.

## Review replay

The occupied-path receipt now reports the branch, HEAD and directory entries on both sides of the restart. In the review run both snapshots were `foreign` at `afe1799681ca40f0b0bdbd73239e03c0bcdae7c6`, containing only `.git`. The reconciler raised the owner hold and launched no worker. Refusal and preservation both held.

`bun test lib/reconcile/launch-recovery.test.ts lib/reconcile/refresh.test.ts lib/thread/runtime.test.ts` passed all 10 checks, including recreation on the saved handle and adoption preserving both histories. The three SIGKILL scenarios took 24.4 seconds combined in this run.
