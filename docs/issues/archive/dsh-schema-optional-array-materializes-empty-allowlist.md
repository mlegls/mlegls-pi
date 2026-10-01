---
priority: 4
stage: done
author: session:01a0e2d3-2fe3-706a-8616-9394e05449d1
---

Obsolete 2026-10-01: the dsh port was deleted in the pi 0.99 rebuild (`4b79baa`).

During [[projects/mlegls-pi/issues/archive/dsh-templated-spawn-and-dispatch]], Schemastery's `z.array(z.string())` materialized an omitted `tools` property as `[]`. The writing preset's optional allowlist therefore became a deny-all filter. Child `108f0c3c-1cdc-4584-a38d-add73fa7bf76` had an empty PTC SDK and `tools.shell` failed; its Node fallback proved cwd isolation but not the intended tool path.

`dsh/dispatch/template.ts` now uses `.default(undefined)` for the optional array. Explicit empty allowlists still mean deny-all. This is a configuration-authoring trap: omitted and empty have different capability meanings. Owner is the schema/configuration boundary; consider whether its documentation or diagnostics should make implicit collection defaults more visible.

decision, 2026-09-30: deferred while DSH isn't the daily harness (its upstream tracker is disabled).
