---
name: dispatch
description: "Use to launch prepared worker assignments."
---

Call `dispatch.dispatch(assignments, options)` in exec; see [the launch contract](../../../../../../docs/dispatch.md). Retain the promise and returned handles. Inspect a failed assignment before retrying; earlier launches survive.

For taking work from intent to done, use `realize`.
