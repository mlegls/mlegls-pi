---
priority: 4
stage: done
author: session:01a0e2d3-2fe3-706a-8616-9394e05449d1
---

Obsolete 2026-10-01: the dsh port was deleted in the pi 0.99 rebuild (`4b79baa`).

While implementing [[projects/mlegls-pi/issues/archive/dsh-templated-spawn-and-dispatch]], `@deepseek-ai/dsh-subagent@0.1.7-rc.2`'s `ContinuableCreateSpec` accepted only a seed. The continuation manager always copied the parent's cwd and preset, and `applyChildComposition` always joined the parent's preset. Provider preparation could not select a child capability set or isolated writing worktree; the one-shot driver was not involved in continuable creation.

The local Bun patch adds provider-owned `cwd` and `agentPreset` creation data and mounts a differing durable child preset during creation and cold resume. It leaves lineage, admission, lifecycle and settlement with the upstream manager. Move this seam into the owning dsh package and retire the patch when an upstream release supplies it. This is not process isolation: absolute paths and host services are still shared.

decision, 2026-09-30: deferred while DSH isn't the daily harness (its upstream tracker is disabled).
