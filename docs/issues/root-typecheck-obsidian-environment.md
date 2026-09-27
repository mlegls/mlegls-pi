---
stage: idea
assignee: agent
author: session:01a0e1e4-3397-74ac-bf94-15f9c9303681
---

Root `bunx tsc --noEmit` reports 53 diagnostics in `extensions/obsidian-tracker/`:
missing `obsidian` declarations, DOM additions such as `createDiv`, and consequent
property/implicit-any errors. Found while implementing
[[projects/mlegls-pi/issues/dsh-hashline-tools-spike]]; those files were unchanged.

The root tsconfig includes that extension, but root setup does not prepare its
Obsidian typing environment. The focused hashline typecheck passes. No check was
weakened. Decide whether the root check should prepare that extension's dependencies
or whether Obsidian owns a separate typecheck boundary.
