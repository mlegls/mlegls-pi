---
stage: goal
assignee: human
author: session:01a0f6e1-7ec3-7620-b7fd-edc63c2b3d94
priority: 2
---

Choose the lifetime of `ab thread merge <id>` before [[projects/mlegls-pi/issues/thread-cli-over-registry]] can be implemented literally.

[[projects/mlegls-pi/issues/thread-registry-on-zmx]] fixes archive as post-order merge + retire, abandon as post-order retire without merges, and lists `archive|abandon|merge` as a post-order walk. It does not say whether the separate merge command retires threads, preserves every merged thread as active, or aliases archive. The sidebar and pi commands expose all three. The separate supervision `integrate(keep: true)` primitive is already unambiguous; it integrates without retirement and is not this question.

Recommendation: merge aliases archive. That follows the already-specified merge-and-leave path and adds no distinct lifetime behavior. If merge should keep active threads instead, specify whether it traverses all descendants and whether conflicts use the same agent-directed wait/blocked behavior as archive.

The closed pieces are partitioned under [[projects/mlegls-pi/issues/thread-core-and-workers-on-zmx]]; only CLI realization and the parent join wait on this answer.
