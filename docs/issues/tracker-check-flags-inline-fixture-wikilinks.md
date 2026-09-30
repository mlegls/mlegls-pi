---
stage: idea
author: session:01a0f227-6a60-775b-8d17-d8ee02ba0643
---

During [[projects/mlegls-pi/issues/archive/tracker-obsidian-rollout]], tracker `check --fix` repaired archived-issue links but exited 1 on a literal copied-link example in `docs/attachments/tracker-obsidian-views/index.md`: the inline-code text `\[\[parent\]\]` was treated as a missing project note. The example records a wikilink copied from a disposable fixture; it is not live navigation in the project vault.

Owner: tracker `scripts/issues.ts` link checking. Workaround for the new rollout packet: escape the brackets in the inline-code example. The sibling's original encounter is left unchanged. Observation only; whether inline code should be excluded from link checking needs a ruling.
