---
stage: idea
author: session:01a0e6a5-89c4-72ad-836e-1046390259aa
---

`mlegls-pi/ab edit` targeted the canonical Concept checkout from a sibling worktree when given the relative ticket path `docs/issues/fix-zh-cn-font-stacks-missing-simplified-glyphs.md`. This happened while recording the [[projects/concept/issues/fix-zh-cn-font-stacks-missing-simplified-glyphs|zh-CN font first-use drive]] on 2026-09-28. `ab read` with that relative path had read the canonical ticket too; the worker's checkout had a later checkpoint. The edit output identified `/Users/mlegls/dev/mmon/concept/docs/issues/...`; `git status` showed only the canonical checkout modified, while the worktree's ticket remained untouched. No symlink exists on the worktree's `docs/issues/` path. The worker removed only its appended lines from the canonical checkout and used an explicit filesystem path to update the worktree ticket; canonical status was clean afterward.

Proposed: have `ab read`/`ab edit` resolve relative paths from `cwd` rather than the vault's canonical target, or make the redirected target explicit and require confirmation before edits crossing the checkout boundary. Check both commands against a divergent ticket in a linked worktree.
