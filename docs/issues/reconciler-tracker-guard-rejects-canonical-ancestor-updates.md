---
stage: "idea"
assignee: "agent"
author: "session:01a130fa-e610-752d-a566-87428a017397"
priority: 2
---
Owning tool/repository: mlegls-pi reconciler integration/tracker guard. During Common Concept's consolidate-the-tutor-tool-catalog run on 2026-10-12, wrap-core-programs-in-theory-and-evaluation review was rejected three times for six docs/issues changes relative to collector base 289dab87. Those changes were canonical stale-claim releases from main commit 865a6255, inherited through the supervisor-authorized shared-stub merge 6a78f7f4. The gate instructed a rebase onto 289dab87, while the supervisor's persistent constraint required retaining main ancestry and the released claims.

Tried: reviewer restored the six issue files (e149aa70) to satisfy the gate, then the supervisor reverted that restoration (0ceddf96) because it would revive dead refine-2 claims. The unchanged branch was rejected again. The worker then raised needs-input. Board evidence: Common Concept topic consolidate-the-tutor-tool-catalog/wrap-core-programs-in-theory-and-evaluation-review-8, messages mv5h1bi7-1kzsge (constraint), mv5h4fmw-8ofik8 and mv5h4y0q-p22mpc (rejections), mv5h4mb8-nvgc1o (question).

Workaround prepared by supervisor: advance collector tree/consolidate-the-tutor-tool-catalog to cf4a367d and merge it into reviewer as f79e9788. Handler verified cf4a367d is their merge-base and git diff --name-status tree/consolidate-the-tutor-tool-catalog...wrap-core-programs-in-theory-and-evaluation-review-8 -- docs/issues is empty. At inspection, reconcile_status still retained landingOps.before=289dab87 and the original result. Handler ruled to retry against the actual destination HEAD without weakening the tracker guard. A successful retry has not yet been observed.

Proposed investigation: distinguish inherited canonical tracker updates from worker tracker writes when checking the child-owned delta, and refresh stale landing-attempt metadata when the destination advances. The recorded stale before value is established; whether the next attempt reuses it has not been verified. Do not prescribe restoring canonical claims or bypassing git hooks as recovery.
