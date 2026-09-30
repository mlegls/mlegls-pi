---
stage: done
assignee: agent
priority: 3
part-of: "[[projects/mlegls-pi/issues/archive/small-ab-cli-fixes]]"
author: session:01a0f065-abaf-776c-bc8b-419cb9b312e4
---

`issues.ts check --fix` repairs every stale link in the tracker, not just the ones a move caused. Archiving three tracker-obsidian issues on 2026-09-30 touched 18 files. Four of those already had another session's uncommitted edits, and `--fix` also repaired unrelated `projects/concept` archive links in them. A scoped commit then meant diffing each file and staging by hand. The same thing earlier forced reverting `--fix` on a file a live branch owned.

Possible shape: `check --fix <moved paths>` (or `--only-links-to`), which rewrites only links whose targets are the given moved issues.

ticket contract, 2026-09-30: `issues.ts check --fix` can be limited to links whose targets moved in this change (for example `check --fix <moved paths>`), and the tracker skill's archive instructions use it.

## Result

Scoped `check --fix <moved paths>` rewrites only links and done `blocked-by` entries targeting those paths; the archive instructions use it. The first-use drive found unrelated done blockers still removed; repaired in review and covered by `issues.test.ts`. [Verification packet](../attachments/tracker-check-fix-rewrites-other-sessions-dirty-files/index.md).

## Verification evidence

[Encounter and evidence](../attachments/tracker-check-fix-rewrites-other-sessions-dirty-files/index.md).
