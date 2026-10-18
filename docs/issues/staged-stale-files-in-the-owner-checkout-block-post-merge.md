---
stage: done
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

## Result

Cause: the writer was the tracker's persister. It commits with `git commit --only -- <paths>`. For a partial commit git stages the paths in the real index, runs the pre-commit hook against a temporary index of its own, and then writes the real index as it was before the hook. concept's pre-commit (`scripts/git-artifacts.ts`) formats what it commits (oxfmt) in the hook's index and in the working tree. So every tracker commit left its paths staged with their pre-format bytes, while HEAD and the working tree held the formatted ones: `MM` with the working tree equal to HEAD. Landings didn't cause it; they were just the next time post-merge checked the index. `alignIndex` (464ba409) rightly keeps entries that hold neither the pre-landing nor the landed version, which is why it didn't help.

The katex occurrence has the same mechanism but another writer. `ebea7883` (21:42, "…save the canvas") was a session's own pathspec commit in the owner checkout. Its committed `canvas.html` has 29,514 lines after formatting; the ~35k-line staged blob was the unformatted original. The issue files staged with it are ones that commit touched. mlegls-pi doesn't run that commit, so this fix doesn't cover it.

Fix (679583a9): after its commit the persister resets to HEAD each path of that write that is still staged but whose working tree matches HEAD (`settleIndex`). Other staged entries are untouched.

Shown on a scripted landing in an owner checkout with a formatting pre-commit and a post-merge that refuses an index differing from HEAD. The script ff-lands, runs tracker `update` and `close`, then ff-lands again. Before the fix, `git diff --cached` named the closed issue file and the second post-merge refused. After it, `git diff --cached` is empty and both post-merges publish. Another session's staged issue file survived the tracker writes. Suite: 252 pass, 2 skip.
