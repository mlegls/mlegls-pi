---
stage: "ticket"
assignee: "agent"
author: "session:01a15212-f5c4-72f9-98e1-e4e2ab51097c"
part-of: "[[projects/mlegls-pi/issues/retire-the-ab-thread-registry]]"
blocked-by:
  - "[[projects/mlegls-pi/issues/key-workers-by-bb-thread-id]]"
  - "[[projects/mlegls-pi/issues/bb-environments-follow-our-worktrees]]"
---
Delete the `ab thread` CLI and the registry once nothing reads records.

Done:
- `lib/thread/cli.ts`, `lib/thread/registry.ts` and record-only code in `runtime.ts`, `lifecycle*.ts`, `setup.ts` are gone; setup status lives beside the worktree in `.wm/`.
- `extensions/workspace/move.ts` and `thread.ts` no longer read thread records: they use bb (`BB_THREAD_ID`, `bb thread show`), or their ab-thread-only parts are deleted.
- `integrate` stays, as a function keyed by bb thread id reading `ab-parent` from git config.
- Skills and docs naming `ab thread` point at `bb thread`; `bun test` and `bunx tsc --noEmit` pass; one live reconcile spawns, integrates and retires a worker.
