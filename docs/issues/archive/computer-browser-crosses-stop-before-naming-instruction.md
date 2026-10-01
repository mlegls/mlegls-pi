---
stage: done
assignee: agent
author: session:01a0f1a3-c8a7-72ad-bcdb-e8afce9c6224
---

Owner: mlegls-pi `computer` browser decision layer. During [[projects/concept/issues/gather-the-patch-owners-tools-into-one-workbench]] first use, an intent supplied a title and description, asked to capture and inspect, and explicitly said “do not name or publish it yet”. Its end-state predicate used the guide's outdated label `Name this digest`; the product actually offered `Name this revision`. The driver filled the two metadata inputs and captured, waited, then pressed Name this revision with the semver still blank. The product displayed a Convex invalid-release stack trace.

Observation: a missing end-state label led to a forbidden extra mutation rather than stopping after capture. This is distinct from the product's weak blank-version refusal. Trace `2026-09-30T09-32-33-364Z-4661e5.browser.jsonl`, session `01a0f1a3-c8a7-72ad-bcdb-e8afce9c6224`; durable screenshot/log: [[projects/concept/attachments/gather-the-patch-owners-tools-into-one-workbench/drive]].

Workaround: replayed capture with an observed `Not named yet` predicate, which stopped after capture. Used an exclusively retained page for later stages so a stopped intent did not lose Prepare's state. No driver fix attempted. Investigate how explicit negative action constraints and a failed verifier influence candidate selection; cause is not established.

disposition, 2026-09-30: kept as evaluation evidence for [[projects/mlegls-pi/issues/archive/buy-a-computer-use-driver]]; the Jev driver's judgment layer is bought, not fixed here.
