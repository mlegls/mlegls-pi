---
stage: idea
assignee: agent
author: session:01a0f6bc-8c6b-7179-b390-af3b53e964e3
---

During [[projects/mlegls-pi/issues/archive/tree-sidebar-bridge-fixes]], root `bun run typecheck` in the checkout based on `c4312ef` reported missing `obsidian`, DOM extensions and cascading plugin diagnostics. `bun install --frozen-lockfile --cwd extensions/obsidian-tracker` installed that package's locked dependencies; the unchanged root check then exited 0. Root setup only installs root dependencies.

This is the setup boundary previously recorded in [[projects/mlegls-pi/issues/archive/root-typecheck-obsidian-environment]], whose done result depended on a prepared checkout. Decide whether root setup should prepare the plugin or root typechecking should leave its separate package to its own check. [Successful check](../attachments/tree-sidebar-bridge-fixes/typecheck.txt).

The same setup failure recurred while refining [[projects/mlegls-pi/issues/archive/thread-core-and-workers-on-zmx]] on base `70540b6` (session:01a0f6e1-7ec3-7620-b7fd-edc63c2b3d94): `bunx tsc --noEmit` reported only missing Obsidian types and cascading plugin diagnostics; the same frozen plugin install made the unchanged root check exit 0. The committed thread stubs typecheck with that preparation. No root setup boundary was changed.

During [[projects/mlegls-pi/issues/replacement-drive-misses-recorded-offline-audit-scope]] on base `68bf25b6` (session:6960c859-5d1d-46c6-b9f8-76b455fa991e), all 26 affected dispatch/wm/thread tests passed, but root `bun run typecheck` reported missing Obsidian types and cascading plugin diagnostics. `bun install --frozen-lockfile --cwd extensions/obsidian-tracker` followed by the unchanged root typecheck exited 0. The workaround is still required in a freshly prepared worker checkout.

The same failure recurred during [[projects/mlegls-pi/issues/reconciler-drive-continuation-loses-managed-process-ownership]] on base `5508756` (session:b367f06f-e5a5-4015-a245-ee4da4cc1a9b): the checkpoint test passed, but root `bun run typecheck` failed with Obsidian DOM/plugin diagnostics. `bun install --frozen-lockfile --cwd extensions/obsidian-tracker` followed by unchanged root typecheck and the checkpoint test exited 0. No root setup boundary was changed.

During [[projects/mlegls-pi/issues/stopped-supervise-jobs-have-no-cleanup-path]] on base `ddcef078` (session:cb3c28b5-31a2-4981-ba1e-2492d075b278), root `bun run typecheck` again reported missing Obsidian types and cascading plugin/DOM diagnostics. The frozen nested install added 11 packages, then the unchanged check passed. [Reproduction and final checks](../attachments/stopped-supervise-jobs-have-no-cleanup-path/index.md). The root setup boundary remains unchanged.
