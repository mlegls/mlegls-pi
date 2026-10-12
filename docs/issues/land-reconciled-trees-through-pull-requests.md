---
stage: goal
assignee: human
author: session:01a12f4c-1aa6-75fe-9c2b-d81acad80dbd
part-of: "[[projects/mlegls-pi/issues/reconcile-github-tracked-projects]]"
blocked-by: ["[[projects/mlegls-pi/issues/reconcile-against-a-global-tracker]]"]
priority: 2
---

The reconciler lands a tree through a GitHub pull request instead of a local merge into the owner's checkout, independent of which tracker backend the project uses. Collector landings stay local. A `pr` phase after `integrate`: push, `gh pr create` with the [pr](../../skills/enabled/all/mlegls/conventions/tracker/references/pr.md) body (`Closes #…` for every node on a GitHub tracker), then poll state, checks, mergeability and review about once a minute. Failing checks go back to the worker like a failed integration, within the same budget; a conflict means rebase and force-push; review comments are a repair, repeated change requests an exception; closed unmerged is an owner exception; merged fast-forwards the owner's checkout, closes the nodes (done = landed in the target) and finishes. The base branch's checks replace `mainRed`.

holes:
- one PR per root tree (fits collectors) or per leaf (no collectors, or stacked PRs; `Closes` only fires on the default branch). Recommendation: per root.
- who merges: a human, or `gh pr merge --auto` once checks and review pass.
- a worker can't idle for days on human review: retire it and relaunch from the branch when comments arrive, through the checkpoint/restart path.
- how a project opts in: `.pi/reconcile.json`, a mise task, or an argument to `reconcile`.
