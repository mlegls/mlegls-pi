---
stage: "done"
assignee: "agent"
priority: 2
author: "session:01a1e11e-1e93-773b-9956-3d4ce13ef0d8"
---
# Pickup never restarts a reopened root

`select` in `lib/reconcile/pickup.ts` skips any frontier row with recorded reconciler state ("has reconciler state (done); restart it by hand") and any row in `started`. A root its reconciler finished as done and someone later reopened as a ticket therefore never runs again unless a person notices.

Observed: [[projects/concept/issues/tag-chunk-refresh-can-exhaust-occ-retries-against-collector]] finished 2026-11-03, was reopened as a ticket on 2026-11-15 after the failure reached production (Sentry CONCEPT-CONVEX-2K/2M), and every pickup scan since has skipped it. The 11-15 daily report's "restart it by hand" note reached nobody; the concept supervisor was idle. Found by the 2026-11-16 efficiency audit (@thread:thr_js85m2wmby).

## tasks

1. A root whose recorded reconciler finished `done` and whose subtree changed after that finish is restartable: pickup starts it as it would a new root and replaces its `started` entry. `stopped` stays skipped (someone stopped it on purpose), as does `done` with no later change, so a reconciler that finishes without closing can't loop.
2. The restarted run starts its phase numbering past the old run's branches: restarting by hand on 2026-11-16 first collided with the leftover `…-implement-1` and `…-drive-2` branches, and the supervisor had to rename them (@thread:thr_ihbpyrp6s2).
3. Done when: a `select` test with a `done` run finished before the row's last change starts it, and the same run with no later change, and a `stopped` run, are still skipped, and a restart beside the old run's phase branches launches without a collision.

Starting the reconciler by hand doesn't work either. On 2026-11-16 `reconcile({issue: "tag-chunk-refresh-can-exhaust-occ-retries-against-collector"})` loaded the old state, which recorded a landing, and at once reported "done … landed in the owner's checkout at 3e3cbc5db", an unrelated tracker commit. The issue was still a ticket and no work had run. The workaround was to stop the reconciler, move its `.json` and `.log` into `.git/reconcile/superseded-<stamp>/`, and start it again. The fresh run then failed to launch, because the first run's `-implement-1` and `-drive-2` branches still existed and weren't owned. They were renamed to `superseded/*` and the launch retried. A reopened root should get fresh reconciler state, with its old worker branches archived, whenever it starts.

Independent drive evidence: [packet](../attachments/pickup-never-restarts-a-reopened-root/index.md). Pickup scan outcomes held; the supplied synthetic-start replay does not reach real reconciler restart or branch-collision acceptance, which remain to be observed.

## Result

done — the original diff only covered pickup's `select`. I added the reconciler-side restart (tasks 2 and 3 plus the manual-start problem), and all 55 tests under `lib/reconcile/` pass.

- **The gap:** the diff had no restart logic in the reconciler. That is why the driver's synthetic-start replay couldn't observe fresh state or branch numbering.
- **The repair:** I added `supersede` in `lib/reconcile/reconcile.ts` and call it from `prepareStart`. Pickup, `reconcile()` and the foreground `run` all go through it.
- **When it fires:** the prior run finished `done` and the root issue is no longer done.
- **What it does:** the old `<root>.json`, `.log` and `.resolutions` move to `<git-common-dir>/reconcile/superseded-<stamp>/`. The new state keeps owner, landing mode, `githubRepository` and the handle counter, and takes its budget from the start.
- **Branches:** because the counter carries over, the new worker is numbered past the old branches (`solo-implement-3` in the test). I don't rename the old branches to `superseded/*`; nothing collides, so I left them in place.
- **Test:** a restart test in `lib/reconcile/resume.test.ts` runs a real reconciler process on fake bb. It starts a `done` state that records a landing, with counter 2, branches `solo-implement-1` and `solo-drive-2`, and the ticket open. It checks no `finished`, empty `landed`, the archive holding the old landing, and a collision-free `solo-implement-3`. Without the repair the same test times out with no worker launched.
- **Evidence:** I appended a Review section to `drive.md` and updated `index.md`. Story 4 now holds.
- **Frictions:** the "restart it by hand" wording stays, since it is accurate for an unchanged done root. The fake-bb flake issue in the diff belongs to another worker, so I didn't triage it.
- **Not run:** `mise run test:affected` isn't declared in this repo, so I ran the whole `lib/reconcile/` directory instead.

```yaml
commit: 8ccc540c (repair 5054eca8, base f8add7988192987c331e5c10e2e59ce1870f1fa2)
stories:
  - story: Later-change done root restarts and replaces its started entry
    outcome: held
  - story: Done root without later change stays skipped
    outcome: held
  - story: Stopped root stays skipped despite later change
    outcome: held
  - story: Restart creates fresh reconciler state and launches beyond existing phase branches
    outcome: held
evidence:
  path: docs/attachments/pickup-never-restarts-a-reopened-root/index.md
  visual: false
  shots: []
tests:
  - lib/reconcile/pickup.test.ts
  - lib/reconcile/resume.test.ts
caveats:
  - "PR-mode runs (recorded `pr`) are not superseded and resume as before. Their staging branch and worktree are keyed to cwd and root, so a fresh state would collide. A reopened PR-mode done root still reports done at once on a manual start."
  - "supersede reads the tracker snapshot on every start of a done prior, which adds one tracker query (pinned tracker CLI) per start."
  - "Pickup computes done-finish time from the state file mtime. A supersede write after a restart refreshes the mtime, which is fine because the new state is not done."
  - "The ticket body's last line still says the real restart 'remains to be observed'. It is now observed; the reconciler closes the ticket with the result."
```

Evidence: [docs/attachments/pickup-never-restarts-a-reopened-root/index.md](../attachments/pickup-never-restarts-a-reopened-root/index.md)
