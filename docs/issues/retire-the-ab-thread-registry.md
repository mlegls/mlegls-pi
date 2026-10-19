---
stage: "done"
assignee: "agent"
author: "session:01a15212-f5c4-72f9-98e1-e4e2ab51097c"
---
Retire the `ab thread` registry (`~/.local/state/ab-threads`, `lib/thread/registry.ts`): bb, git config and the reconciler's own state hold what it records. Worker worktrees stay ours.

Decided 2026-10-19 with the maintainer, after `replace-the-board-with-bb-mail`. The `ab thread` commands go: "cli agents can still use bb".

What each record field becomes:
- bb thread id, spawn parent, archived, worktree path and branch, session file: bb (thread, environment, `providerThreadId`).
- `worker {run, handle}`: the reconciler's and wm's own run state, which already keeps the thread id per handle; `workerThread(handle)` (6 call sites in `lib/reconcile/reconcile.ts`, `refinement.ts`) reads that instead.
- `ownership`: a worktree is ours to remove when a wm or reconciler spawn created it, as recorded in that run's state.
- Merge target: `branch.<b>.ab-parent` in git config, unchanged; merged-ness comes from git ancestry.
- `seenAt`, `interactive`, `attention`, `terminals`, `delta`: served only the deleted `ab thread ls` view; dropped.

Why worktrees stay ours (alternative filed as [[projects/mlegls-pi/issues/hand-worker-worktrees-to-bb]]): bb's `--new-environment worktree` names branches `bb/<slug>-<thr_id>`, has no pre-launch hook for the reconciler's `prepare` (`.wm/` files, pre-merging a collector), and deletes untracked state at teardown, which our retirement keeps in `__retired/`.

What bb shows today is right: the 11 live worker worktrees' environments show their branch (2 mismatches are arkhai workers that switched branch themselves). But 1,071 of 1,082 attached checkout environments point at worktrees that no longer exist, because retirement removes the folder without telling bb.

## Result

done: the three children fit together and I found no seam defects. The only issues were stale comments and two dead exports, which I fixed.

The supplied `13f2a4a6..HEAD` range holds only tracker docs, because the children had already landed on the collector. I reviewed the combined change from `0fd64560` instead.

- **Contract:** every record field in the parent spec now has a home. The bb thread id lives in `WorkerThread.id` and `Handle.bb`. Worker identity is the bb title `<run>/<handle>` plus run state. Worktree ownership comes from `workerOf`, which wm and reconcile spawns satisfy. The merge target is still `branch.<b>.ab-parent`. The fields only the deleted `ab thread ls` view used are gone.
- **Leftovers:** nothing reads `~/.local/state/ab-threads`, `lib/thread/registry` or `lib/thread/cli`. `bin/ab` offers only `desk`. `AB_THREAD_ID` survives only in a few test env scrubs.
- **Checks:** `tsc --noEmit` is clean. The affected tests (`lib/reconcile`, `lib/thread`, `lib/wm-reattach`, `lib/dispatch`, `extensions/bb`) pass after the repairs: 47 pass, 0 fail.
- **One failure in a broader run:** the `lib` + `extensions/workspace`, `extensions/bb`, `extensions/supervision` run had one failure, the rate-limit reconciler test in `lib/tracker-github.test.ts`. It passes alone and the file is untouched here, so I read it as a load-timing flake.

Repairs in `d4e88ec9`, all behavior-preserving:
- Comments in `lib/reconcile/reconcile.ts`, `lib/reconcile/pr-types.ts` and `lib/wm.ts` that still said "registry" now say bb thread.
- Removed `waitBb`, which was already unused, and `openBb`, which the deleted `attachThread` had been the only caller of.
- `lib/reconcile/main.ts` stop now uses the shared `commonDir` helper instead of its own `git rev-parse`. If the checkout isn't a git repo it skips the lookup instead of throwing.

I appended the review to the driver's packet.

```yaml
commit: d4e88ec9
stories: []
evidence:
  path: docs/attachments/retire-the-ab-thread-registry/index.md
  visual: false
  shots: []
tests: []
filed: []
changes:
  - "reconcile stop uses commonDir (lib/thread/git.ts) instead of its own git-common-dir call"
  - "removed dead bb exports openBb and waitBb"
caveats:
  - "Parent has no parent-only stories; the children's gates and packets stand on their own."
  - "Test files still scrub AB_THREAD_ID from the env (harmless leftover, left untouched)."
  - "No wall-time or cost trade-offs to report."
```

Evidence: [docs/attachments/retire-the-ab-thread-registry/index.md](docs/attachments/retire-the-ab-thread-registry/index.md)
