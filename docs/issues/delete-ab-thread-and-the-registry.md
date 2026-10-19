---
stage: "done"
assignee: "agent"
author: "session:01a15212-f5c4-72f9-98e1-e4e2ab51097c"
part-of: "[[projects/mlegls-pi/issues/retire-the-ab-thread-registry]]"
---
Delete the `ab thread` CLI and the registry once nothing reads records.

Done:
- `lib/thread/cli.ts`, `lib/thread/registry.ts` and record-only code in `runtime.ts`, `lifecycle*.ts`, `setup.ts` are gone; setup status lives beside the worktree in `.wm/`.
- `extensions/workspace/move.ts` and `thread.ts` no longer read thread records: they use bb (`BB_THREAD_ID`, `bb thread show`), or their ab-thread-only parts are deleted.
- `integrate` stays, as a function keyed by bb thread id reading `ab-parent` from git config.
- Skills and docs naming `ab thread` point at `bb thread`; `bun test` and `bunx tsc --noEmit` pass; one live reconcile spawns, integrates and retires a worker.

## Result

done. The registry retirement holds on my head, `13f2a4a6`. The live reconcile spawned, integrated and retired a worker in a scratch repo.

- **Live reconcile:** I ran one reconcile in a disposable `/tmp` scratch repo with budget 1 and `--land local`, owned by this reviewer thread.
  - It launched implement, drive and review workers as bb threads, then landed `add-hello` in the scratch repo's `main`. `HELLO.md` was there and the tree was clean.
  - All three bb threads were archived and their environments deleted; no worktrees remained.
  - Each retired worker's branch is still in the scratch repo, as it is for earlier runs in this repo. I did not trace why. The scratch repo, its bb project and its worktrees are deleted, the reconciler had finished, and I did not touch the running `retire-the-ab-thread-registry` reconciler.
- **Setup status:** in the worker worktree, `.wm/setup.json` read `{"state":"done","code":0,…}` and `.wm/setup.log` held the setup output. `.wm/` is excluded automatically, so integrate saw a clean tree.
- **Legacy CLI and records:** `bin/ab` only offers `desk`. No source references `ab thread`, `lib/thread/registry`, `lib/thread/cli`, `ThreadRecord`, `getThread`, `threadForBb` or `threadForSession`. No skill or doc outside the historical attachments names `ab thread`.
- **Tests:** full `bun test` on the head I reviewed: 214 pass, 2 skip, 0 fail. `bunx tsc --noEmit` is clean. After my repairs I reran tsc and the affected tests (21 pass).
- **Repairs:** I removed a stale doc comment on `Worker` in `lib/wm.ts`. I flattened leftover bare `{}` blocks in `cleanupThread` (`lib/thread/lifecycle-cleanup.ts`) and `retire` (`lib/dispatch.ts`). Both are behavior-preserving. I appended the review to the driver's packet.
- **Frictions:** I filed no new issues and found nothing new from the workers' reports to settle.

```yaml
commit: 13f2a4a6
stories:
  - story: bb identifies the worker and owned checkout
    outcome: held
  - story: Setup status persists in .wm
    outcome: held
  - story: Live reconcile spawns, integrates and retires
    outcome: held
  - story: Legacy CLI and record dependencies removed
    outcome: held
evidence:
  path: docs/attachments/delete-ab-thread-and-the-registry/index.md
  visual: false
  shots: []
tests: []
filed: []
caveats:
  - "Live lifecycle cost: three real agent phases (implement, drive, review) in bb, about 2.5 minutes; the scratch repo and its bb project are removed."
  - "No test assertions changed."
```

Evidence: [docs/attachments/delete-ab-thread-and-the-registry/index.md](docs/attachments/delete-ab-thread-and-the-registry/index.md)
