---
name: git-sync
description: Sync with remote by handling unstaged changes and rebasing on top of upstream.
disable-model-invocation: true
---

Triage unstaged/untracked changes — gitignore, stash, or commit each as appropriate. Then `git fetch && git rebase`, pop any stash.
