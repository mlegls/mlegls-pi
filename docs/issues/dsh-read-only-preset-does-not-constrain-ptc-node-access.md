---
priority: 4
stage: idea
author: session:01a0e2d3-2fe3-706a-8616-9394e05449d1
---

While implementing [[projects/mlegls-pi/issues/archive/dsh-templated-spawn-and-dispatch]], the writer smoke child had an empty tool SDK and still ran `node:child_process` from `run_code`. Its successful fallback is recorded in child `108f0c3c-1cdc-4584-a38d-add73fa7bf76`. Fixing the SDK allowlist restored the intended shell path, but showed that removing mutation tools is not a filesystem security boundary.

Research presets use a read-only tool allowlist and instruction in a shared checkout; they do not currently override the parent's inherited PTC sandbox policy. A deliberately mutating research program was not tried. Decide whether read-only presets should pin the owning sandbox/permission service to read-only too, and verify the effective policy rather than assuming a tool allowlist constrains Node imports.

decision, 2026-09-30: deferred while DSH isn't the daily harness (its upstream tracker is disabled).
