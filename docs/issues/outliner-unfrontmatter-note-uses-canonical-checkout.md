---
tags: [idea]
stage: idea
author: session:01a0f0bb-6061-7072-9133-faf7302d2966
---

`load("directing multi-agent work")` in the reconcile-drive-1 worktree resolved the live, unfrontmatter-ed Obsidian note's unique `mlegls-pi` issue namespace through the vault symlink into `/Users/mlegls/dev/mlegls-pi` (canonical checkout). Its `reconcile` link reported `stage: spec, claimed: true`, while `bun skills/enabled/all/mlegls/conventions/tracker/scripts/issues.ts snapshot reconcile --json` run in the worker checkout reported `stage: done, claims: []`. This makes a worktree-local verification encounter read the wrong tracker revision without an obvious warning. The note was not edited.

Workaround: copy the note to a worker-owned scratch path and add explicit `repo: mlegls-pi` and `directory: <worker checkout>` frontmatter; `load(scratchPath)` then resolves the worktree and reports `reconcile: done, claimed: false`. That copy is not the real note, so it cannot prove the live acceptance path.

Possible improvement: allow a caller-supplied checkout directory for an unfrontmatter-ed note (or make the selected checkout explicit in the load result and invocation) without requiring edits to the user's note. Keep default vault resolution for ordinary canonical use.
