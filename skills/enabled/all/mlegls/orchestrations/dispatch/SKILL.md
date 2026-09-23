---
name: dispatch
description: "Use to launch prepared worker assignments."
---

Call `dispatch.dispatch(assignments, options)` in exec, or from bash `ab lib dispatch dispatch '<assignments>' '<options>' > receipt.json` (JSON arguments; Paseo/Orca hosts only, since standalone `wm` needs the pi host); see [the launch contract](../../../../../../docs/dispatch.md). Retain the promise and native handles. Serialize waves; include every outstanding worker in the parent-scoped capacity budget. Inspect a failed assignment before retrying; earlier launches survive.

For taking work from intent to done, use `supervise`.

For tracker work, pass each issue’s own `assignee` (including absence) to `route.prepare`, then carry `issue` and `assignee` into dispatch. Re-read child assignments when decomposing; explicit human/session ownership requires its owner.
