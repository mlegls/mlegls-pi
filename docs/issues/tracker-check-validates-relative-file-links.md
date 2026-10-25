---
stage: "goal"
assignee: "agent"
priority: 2
author: "session:thr_97xxb6d8ii"
---
"an "outsider" (which every fresh context is, and which i am for issues i wasn't deeply involved in) should be able to thoroughly understand what an issue is about just by recursively following its links. this is part of the point of having it obsidian-format. so file links should be real links" (maintainer, 2026-10-25, @thread:thr_97xxb6d8ii)

[issues.ts](../../skills/enabled/all/mlegls/conventions/tracker/scripts/issues.ts) `check` validates wikilinks only. In mmon/concept, 862 of the 2,280 relative Markdown links under `docs/` don't resolve (2026-10-25). Most are written repository-relative (`[x](docs/attachments/y/index.md)` from `docs/issues/`, which resolves to `docs/issues/docs/...`), and archiving an issue moves it one directory down, which breaks file-relative links that were right. `close --evidence` wrote the repository-relative form too, until 5a718867.

So `check` reports a relative link that doesn't resolve, and `check --fix` repairs the two mechanical cases: a repository-relative path that resolves from the repository root, and a link shifted by an archive move (about 411 of the 862). The rest are reported for a person to look at; reporting them only for live issues keeps `check` usable while the archive is cleaned up.
