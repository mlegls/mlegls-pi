---
stage: done
assignee: agent
priority: 3
part-of: "[[projects/mlegls-pi/issues/archive/small-ab-cli-fixes]]"
author: session:01a0f227-6a60-775b-8d17-d8ee02ba0643
---

During [[projects/mlegls-pi/issues/archive/tracker-obsidian-rollout]], tracker `check --fix` repaired archived-issue links but exited 1 on a literal copied-link example in `docs/attachments/tracker-obsidian-views/index.md`: the inline-code text `\[\[parent\]\]` was treated as a missing project note. The example records a wikilink copied from a disposable fixture; it is not live navigation in the project vault.

Owner: tracker `scripts/issues.ts` link checking. Workaround for the new rollout packet: escape the brackets in the inline-code example. The sibling's original encounter is left unchanged. Observation only; whether inline code should be excluded from link checking needs a ruling.

ticket contract, 2026-09-30: `check` doesn't treat wikilinks inside inline code or fenced code as live links, with a test; then un-escape the example in `docs/attachments/tracker-obsidian-rollout/` if it was escaped only to satisfy the check.

## Result

[First-use CLI drive packet](../attachments/tracker-check-flags-inline-fixture-wikilinks/index.md): inline/fenced examples ignored, live-link diagnostics retained, archive fixing preserved code examples, and the rollout example is unescaped inline code. The supplied test runner passed 19 tests. Assertion adequacy remains for review. Setup friction is recorded with the existing [handoff owner](mail-drive-handoff-names-only-a-test-runner.md).

## Verification evidence

[Encounter and evidence](../attachments/tracker-check-flags-inline-fixture-wikilinks/index.md).
