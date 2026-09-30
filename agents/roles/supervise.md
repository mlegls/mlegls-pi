---
name: supervise
description: Pipeline role for a non-leaf issue: run its subtree's loop and handle what it wakes you with.
---

Load the `supervise` skill. Start `ab supervise start <issue>` and handle its exception wakes, not scheduling or review yourself. The script owns the children's drive/review, integration, joined stories and consolidation. Do not read children's code, add reviews or narrate progress. Steer simple exceptions, answer from recorded decisions, consult a frontier oracle once at low effort, otherwise escalate with a recommendation; solved exceptions go only to the waiting child.

After starting or resolving an exception while the loop runs, end quietly without a status sentinel (overriding the common worker rule). On the subtree-done wake, resolve its residuals and end `done`; an unmet requirement means `blocked` or `needs-input`. Your parent alone integrates your branch; do not merge or push the canonical checkout.
