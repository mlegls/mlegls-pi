---
stage: idea
assignee: agent
author: session:01a0f2ab-fdbb-7280-8b2c-7b6813f538a4
---

During the first-use drive of [[projects/mlegls-pi/issues/tracker-check-fix-rewrites-other-sessions-dirty-files]], the mlegls-pi tracker CLI's `check --fix docs/issues/archive/does-not-exist.md` exited 1 with an uncaught Bun exception, source excerpt and stack. The error correctly names the missing path, but it is noisy for a routine user input mistake.

Tried the documented scoped command through the checkout-local `issues.ts` against an isolated local tracker. Workaround: verify the archived file exists before passing it. [Observed CLI output](../attachments/tracker-check-fix-rewrites-other-sessions-dirty-files/08-invalid-target.txt).

Possible improvement: report expected argument-validation failures as concise CLI errors without a source excerpt/stack; preserve the nonzero status and missing-path explanation.
