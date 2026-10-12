---
stage: goal
assignee: human
author: session:01a12f4c-1aa6-75fe-9c2b-d81acad80dbd
priority: 2
---

`reconcile` runs a ready subtree in a project tracked on GitHub (issues, sub-issues, dependencies) and lands it through a pull request, as it does today for vault projects landing locally. The tracker skill already describes the GitHub model ([issue-tracker-github](../../skills/enabled/all/mlegls/conventions/tracker/references/issue-tracker-github.md), [pr](../../skills/enabled/all/mlegls/conventions/tracker/references/pr.md)); the reconciler (`lib/reconcile/`) only knows the vault.

substeps:
1. [[projects/mlegls-pi/issues/reconcile-against-a-global-tracker]]: the reconciler reads and writes a tracker with one global state behind an interface; the vault becomes its first backend. Worthwhile on its own.
2. then, in parallel: [[projects/mlegls-pi/issues/github-issues-as-a-tracker-backend]] and [[projects/mlegls-pi/issues/land-reconciled-trees-through-pull-requests]].

decisions:
- 2026-10-12: the tracker is global even for the vault; that vault issues are committed in git is storage, and no behavior depends on it. This removes the per-branch tracker views the reconciler leans on today, which a GitHub tracker can't have.
