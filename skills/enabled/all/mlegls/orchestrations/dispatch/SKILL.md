---
name: dispatch
description: "Use to launch prepared worker assignments."
---

Call `dispatch.dispatch(assignments, options)` in exec; see [the launch contract](../../../../../../docs/dispatch.md). Retain the promise and returned handles. Inspect a failed assignment before retrying; earlier launches survive.

For taking work from intent to done, use `realize`.

For tracker work, pass each issue’s own `assignee` (including absence) to `route.prepare`, then carry `issue` and `assignee` into dispatch. Re-read child assignments when decomposing; explicit human/session ownership requires its owner.
