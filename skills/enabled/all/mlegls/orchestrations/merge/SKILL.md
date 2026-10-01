---
name: merge
description: "Use to integrate a settled worker's branch and retire its host resources."
---

Once completion is accepted: `tools.integrate({worker, mode?, keep?})` ([contract](../../../../../../docs/dispatch.md#integration)). Pass the retained `submitted` handle.

Rebase onto parent HEAD and fast-forward by default; `mode: "merge"` for a merge commit. A conflict returns `{conflict: true, files}`: send the files to the worker to resolve on its branch. `keep: true` integrates without cleanup; `tools.retire` cleans up without integrating.

Cleanup follows Git integration. Inspect a cleanup failure before repeating it; the merge remains.
