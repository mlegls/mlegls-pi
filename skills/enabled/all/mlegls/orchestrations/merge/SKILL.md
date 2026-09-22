---
name: merge
description: "Use to integrate a settled Orca worker: merge its branch and retire its dispatch, terminals and worktree."
---

once worker_done is validated against the Dispatch: `dispatch.integrate(handle, {mode?, keep?})` ([contract](../../../../../../../docs/dispatch.md#integration)). `handle` is the `submitted` entry from the wave receipt, or `{worktreeId, path, receipt: {dispatchId}}` reassembled from `orca.workers.list` and `orca worktree list`.

rebase onto the parent HEAD and fast-forward by default; `mode: "merge"` for a merge commit. a `MergeConflict` leaves both trees as they were: send `.files` to the worker to resolve on its branch, then integrate again. `keep: true` merges without retiring anything.

ack the delivery after integrating.
