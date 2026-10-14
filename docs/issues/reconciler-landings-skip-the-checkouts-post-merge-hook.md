---
stage: idea
assignee: agent
author: "session:thr_vetzcc74ex"
---

Reconciler landings into a checkout's main no longer run that checkout's `post-merge` hook. Observed in concept on 2026-10-13 and 2026-10-14: the landings at `d7459f50` and `f4a9b9a5` (and every landing between) left `.git/verify-main/want` stale, so `verify:main` never started. They also left main 34 commits ahead of `origin`, because the hook is what pushes main and starts verification. Both were done by hand.

Likely cause: the bb-backed integration advances main without `git merge` (e.g. `update-ref`) or with hooks disabled.

Done when a reconciler landing into a branch whose checkout has a `post-merge` hook runs it once, as a fast-forward merge would, or explicitly invokes the checkout's landing hook; and a concept landing starts `verify-main.sh` and pushes main without supervisor action.
