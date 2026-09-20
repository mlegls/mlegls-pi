---
name: resolving-merge-conflicts
description: "Use when resolving an in-progress Git merge or rebase conflict."
---

A conflict is between two intended changes, not just two versions of a hunk.
Read the operation state and the commits, issues, or PRs that explain each side.

1. Resolve toward the merge's intended result, preserving both changes where
   compatible. If their goals conflict, surface the choice rather than
   silently inventing a third behavior.
2. Check the integrated result, including interactions outside the conflicted
   lines. Run the relevant project checks and inspect the diff.
3. Stage the resolved files and continue the existing merge or rebase when
   the result is ready. Repeat as needed for later rebase commits.

Neither aborting nor choosing a whole side is a substitute for understanding.
If abandoning the operation is actually the right move, explain why and agree
on it before discarding progress.
