---
stage: idea
assignee: agent
priority: 3
author: session:01a0f065-abaf-776c-bc8b-419cb9b312e4
---

`issues.ts check --fix` repairs every stale link in the tracker, not just the ones a move caused. Archiving three tracker-obsidian issues on 2026-09-30 touched 18 files. Four of those already had another session's uncommitted edits, and `--fix` also repaired unrelated `projects/concept` archive links in them. A scoped commit then meant diffing each file and staging by hand. The same thing earlier forced reverting `--fix` on a file a live branch owned.

Possible shape: `check --fix <moved paths>` (or `--only-links-to`), which rewrites only links whose targets are the given moved issues.
