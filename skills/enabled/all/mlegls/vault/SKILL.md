---
name: vault
description: Use to reconcile an Obsidian outliner with its project's tracker and code state.
argument-hint: "a note or project, optionally filtered by characteristic tags"
---

1. Read the outliner and ~/obsidian/workflows.md at call time. Resolve its project from frontmatter repo/directory and linked issues; use `tracker` for tracker conventions. Include plans, fleeting, and efforts, with nested context; characteristic tags filter the scope.
2. Compare the in-scope bullets with the tracker and relevant code. Show what each resolves to, contradictions, and live project issues not linked from the outliner. Distinguish recorded status from verified reality.
3. Discuss new or unresolved intent in this session (`grilling`). Reuse existing issues where they fit; write agreed tracker changes directly, preserving open questions as such.
4. Propose a disposition for each bullet needing a change: link its issue, move committed work into efforts, mark completed work #done, or remove what we agree to drop. Show the outliner diff before applying it. Preserve the user's wording and nested context; reread before applying and re-propose if the note changed.
5. Summarize what changed and what still needs a decision. Implementation and worker dispatch are separate, explicitly requested actions.

For explicitly requested supertag processing, use [tag handlers](references/tag-handlers.md). `lib/vault.ts`'s `run()` is that tag-processing path, not reconciliation.
