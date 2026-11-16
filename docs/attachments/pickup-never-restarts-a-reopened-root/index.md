# Reopened pickup root: first-use evidence

[Independent drive](drive.md): pickup scan outcomes held; real reconciler restart, branch archival and collision-free worker launch remain unobservable through the supplied synthetic-start replay.

Run from the checkout root:

```sh
bun docs/attachments/pickup-never-restarts-a-reopened-root/first-use.ts
```

The replay creates and removes its own temporary Git repository, configures pickup without a watcher, and calls the exported `scan` API. Its start callback returns synthetic PIDs; no bb worker is launched. No authentication or existing project state is needed.

Observed on the implementation branch:

- First pickup starts `reopened` with PID 101.
- A recorded done state newer than the issue leaves it skipped.
- Moving the issue's change time after completion starts `reopened` again and replaces the recorded PID with 102.
- A stopped state stays skipped despite the later issue change.

The ticket-authorized `select` test also covers a later child change, equal/earlier change times, and settling before restart. `bun test lib/reconcile/pickup.test.ts`: 4 passed. `bun run typecheck` passed. This is implementation first-use evidence; independent driving follows.

Completion time is the recorded reconciler state file's mtime, written by the final state save. Subtree change time uses the existing issue-file mtime mechanism. Backends without local issue files still have no change time.
