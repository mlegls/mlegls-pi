---
name: dispatch
description: "Use to launch prepared worker assignments."
---

`tools.dispatch({run, assignments, maxConcurrent?, active?})` in codemode; see [the launch contract](../../../../../../docs/dispatch.md). Each assignment names an `agent` stance, whose model list routes through `stance/<agent>`, or an exact `model` and `effort`. Retain the receipt's `submitted` handles. Serialize waves; include every outstanding worker in `active` for the parent-scoped budget. Inspect a failed assignment before retrying; earlier launches survive.

For taking work from intent to done, use `supervise`.

For tracker work, carry each issue's `issue` and `assignee` (including absence) into its assignment. Re-read child assignments when decomposing; explicit human/session ownership requires its owner.
