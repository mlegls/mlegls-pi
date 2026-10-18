---
stage: ticket
assignee: agent
priority: 1
author: "session:ca48dc62"
---

During Common Concept's overnight tend run (2026-10-17), the main checkout's index repeatedly held staged copies of files that matched HEAD on disk, which made `.husky/post-merge` refuse to publish or verify (`Final-tree regeneration requires an index matching HEAD`). Observed at least five times, each right after a reconciler landing into main:

- after `wait-for-migration-readiness-by-progress-not-a-fixed-deadline` (twice) and `rehearse-production-copies-without-fabricating-scheduler-state`: the just-closed issue file was staged with a reformatted YAML block (`{ story: … }` → `{story: …}`), i.e. the pre-formatter text, while the worktree held the committed (formatted) text;
- after `load-the-katex-stylesheet-that-matches-rehype-katex`: three issue files plus `docs/issues/attachments/2026-10-17-main-pages-design/markdown/canvas.html` staged, the canvas's staged blob an older ~35k-line version; worktree matched HEAD;
- end of run: 26 issue files staged `MM` with working tree equal to HEAD.

Each time `git reset -q` (index only) cleared it with no content loss and the hook then ran. `464ba409` (fast-forward integrations reset changed index entries to HEAD before post-merge) did not prevent the later occurrences.

Likely writer: tracker persistence (vault → repo) or the integrate path staging files in the main checkout's index from a stale source after the landing commit; root cause unknown. Find the writer and make it never leave the canonical index differing from HEAD. Done when a landing followed by tracker closes leaves `git diff --cached` empty in the owner checkout, demonstrated on a scripted landing; no concept-side workaround.
