---
stage: idea
assignee: agent
author: session:01a0f2af-833b-70b9-8e0c-0d5b098a8191
---

While reviewing [[projects/mlegls-pi/issues/archive/bun-test-ab-selects-disabled-tool-tests-with-uninstalled-commander]], a full root `bun test` (Bun 1.4.2, 83 files) reported 7 failures, one more than the driver's 6: `extensions/bash/lifecycle.test.ts` "focused output stays verbatim and oversized output has a searchable original", failing at `lifecycle.test.ts:65`. The other six are owned elsewhere (optional dsh, prearchive orchestration-audits report).

Rerunning that file alone: one failure in the first 3 runs (1 fail / 0 / 0), then 6 consecutive passes. The failing run was concurrent with the whole suite; the full error text was not captured.

Line 65 is `expect(body).toContain("Grep this file")` on the 60000-character result, i.e. the oversized-output notice was absent from that run. Proposed improvement (not tried): rerun under load with output captured to see why.

A subsequent first-use drive of [[projects/mlegls-pi/issues/archive/root-bun-test-selects-unprepared-optional-dsh]] captured both variants on Bun 1.4.2: the full root run again failed the notice assertion at `:65:16`; three isolated runs gave pass/fail/pass, with the middle run failing recovered-output equality at `:67:38`. [Drive observations and complete CLI receipts](../attachments/root-bun-test-selects-unprepared-optional-dsh/driver.md). No lifecycle implementation was read or repaired; the cause remains unverified.
