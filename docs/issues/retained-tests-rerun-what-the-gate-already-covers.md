---
stage: idea
priority: 4
author: "session:95cf9e55-d246-406a-a3bc-f0780b3b2a49"
---

From [[projects/concept/issues/streamline-validation-by-value-and-wall-time]]: `land()` runs `s.tests[into]` (every test file earlier reviewers retained for that collector) plus this child's, on every landing. `testRun` only runs `*.test.*` files (via `bun test`), executables and `.sh` scripts, so Playwright specs never run here. When the project's `pre-integrate` already runs the whole `bun test` suite (concept's does, 14 s), every retained `*.test.*` file is a duplicate. Retained scripts (drive recipes) are not covered by it, and their cost is unmeasured.

Unmeasured how much time this costs; probably seconds per landing for test files. Worth acting on only if retained scripts turn out to be heavy.
