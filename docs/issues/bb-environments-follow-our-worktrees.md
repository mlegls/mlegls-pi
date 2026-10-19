---
stage: "done"
assignee: "agent"
author: "session:01a15212-f5c4-72f9-98e1-e4e2ab51097c"
part-of: "[[projects/mlegls-pi/issues/retire-the-ab-thread-registry]]"
---
bb's environment for each worker worktree reflects its merge target and goes away with it.

Done:
- At spawn, wm sets the environment's `merge_base_branch` from `branch.<b>.ab-parent` (`bb environment update --merge-base-branch`), so bb's diff compares against the real merge target.
- After retirement removes a worktree, it deletes the bb environment. First check on one stale environment what `bb environment delete` does to an attached checkout whose folder is gone (no error, no thread lost).
- A one-off sweep deletes the ~1,071 ready environments whose path no longer exists, across projects; report the count.

## Independent verification

[CLI evidence packet](../attachments/bb-environments-follow-our-worktrees/index.md), [drive log](../attachments/bb-environments-follow-our-worktrees/drive.md), commit `8ac87aed`: 1,101 historical destroyed rows corroborated and probe threads preserved. Live supervisor-created driver had null merge base despite recorded ab-parent; retired implementer left one ready missing-path environment. Runtime provenance is unknown; changed checkout-local spawn/retire still needs driving before acceptance. Test-only handoff friction added to [[projects/mlegls-pi/issues/mail-drive-handoff-names-only-a-test-runner]].

## Result

done. I drove this checkout's own spawn and retire against the live BB, found a defect that failed every fresh-path spawn, and fixed it in `c5262c6c`.

**The defect.** For a path with no environment yet, `bb thread spawn --environment <path>` returns `environmentId: null`; the environment appears shortly after. `spawnBb` passed `undefined` to `bb environment update`, which got a 404. The failure cleanup then 404'd on `environment delete` too and hid the cause. Five of five fresh-path `bin/ab thread new --worktree …` runs failed with `Environment not found`.

**The fix.** In `lib/thread/bb.ts`, `spawnBb` now reads the environment id from `bb thread show` (polled up to about 10 s) before updating the merge base. Failure cleanup and retirement go through `deleteBbEnvironment`, which skips a thread that has no environment.

**After the fix, on a fresh path:**
- **Spawn:** the environment's `mergeBaseBranch` equals the branch's ab-parent with no manual update.
- **Retirement:** `ab thread abandon` removes the worktree and branch. The environment ends `destroyed` with path null, and the thread stays archived with `deletedAt` null.

**Sweep.** The read-only sweep found 12 stale ready rows. Seven were leftovers from my failed probes before the fix. Five were retired by the older supervisor runtime: this ticket's implement-2 and drive-3 environments plus three other projects' workers. That explains the driver's observation that retirement left a row behind. I ran the authorized sweep with `--apply`: 12 requested, 0 failed. A re-run shows 20 ready and 0 stale. The ticket's total is now 1,113 destroyed (1,106 real stale rows plus the 7 probe leftovers). The driver's packet is updated in `drive.md`.

**Tests.** `bun test lib/thread/runtime.test.ts lib/thread/lifecycle.test.ts lib/dispatch.test.ts` passes except for one intermittent 5 s timeout in a sibling lifecycle test ("archive conflict answered … is not a resolution"). It fails on base `0fd64560` too, on a different sibling, and the other test I ran alone passed. I treat it as load flakiness and left it alone. I did not run `tsc` after the final change, and no tests changed.

```yaml
stories:
  - story: Spawn environment reflects ab-parent
    outcome: held
  - story: Retirement removes environment
    outcome: held
  - story: Stale deletion preserves threads
    outcome: held
  - story: One-off sweep reports deletion count
    outcome: held
evidence:
  path: docs/attachments/bb-environments-follow-our-worktrees/index.md
  visual: false
  shots: []
tests:
  - lib/thread/runtime.test.ts
  - lib/thread/lifecycle.test.ts
  - lib/dispatch.test.ts
commit: c5262c6c
fixed:
  - "c5262c6c: spawn resolved a null environmentId, so every fresh-path spawn failed"
redrive: false
caveats:
  - "Spawn now waits for bb to create the environment, polling `bb thread show` every 100 ms, up to ~10 s. In my runs the first poll already succeeded."
  - "Intermittent 5 s timeout in a lifecycle archive-conflict test; also fails on base 0fd64560."
  - "Probe threads and environments I created are stopped, archived or destroyed. My review worktree's own project-checkout environment is untouched. No servers or processes left running."
```

Evidence: [docs/attachments/bb-environments-follow-our-worktrees/index.md](docs/attachments/bb-environments-follow-our-worktrees/index.md)
