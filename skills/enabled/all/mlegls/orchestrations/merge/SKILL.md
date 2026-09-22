---
name: merge
description: "Use to integrate a settled worker's branch and retire its host resources."
---

Once completion is accepted: `dispatch.integrate(handle, {mode?, keep?})` ([contract](../../../../../../docs/dispatch.md#integration)). Pass the retained `submitted` handle.

Rebase onto parent HEAD and fast-forward by default; `mode: "merge"` for a merge commit. Send `MergeConflict.files` to the worker to resolve on its branch. `keep: true` integrates without cleanup.

Archive/cleanup follows Git integration. Inspect a cleanup failure before repeating it; the merge remains. Orca deliveries are acknowledged after handling; Paseo uses native completion notifications.
