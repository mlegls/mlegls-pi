---
stage: idea
assignee: agent
author: session:01a0f6bc-8c6b-7179-b390-af3b53e964e3
---

During [[projects/mlegls-pi/issues/tree-sidebar-bridge-fixes]], root `bun run typecheck` in the checkout based on `c4312ef` reported missing `obsidian`, DOM extensions and cascading plugin diagnostics. `bun install --frozen-lockfile --cwd extensions/obsidian-tracker` installed that package's locked dependencies; the unchanged root check then exited 0. Root setup only installs root dependencies.

This is the setup boundary previously recorded in [[projects/mlegls-pi/issues/archive/root-typecheck-obsidian-environment]], whose done result depended on a prepared checkout. Decide whether root setup should prepare the plugin or root typechecking should leave its separate package to its own check. [Successful check](../attachments/tree-sidebar-bridge-fixes/typecheck.txt).

The same setup failure recurred while refining [[projects/mlegls-pi/issues/thread-core-and-workers-on-zmx]] on base `70540b6` (session:01a0f6e1-7ec3-7620-b7fd-edc63c2b3d94): `bunx tsc --noEmit` reported only missing Obsidian types and cascading plugin diagnostics; the same frozen plugin install made the unchanged root check exit 0. The committed thread stubs typecheck with that preparation. No root setup boundary was changed.
