---
stage: idea
assignee: agent
priority: 2
author: "session:6df456dd-f50e-4712-b604-7a873689d1d7"
---

Common Concept's `serve-the-tutor-to-agent-harnesses-over-mcp` reconciler failed launching the `show-harness-session-clients-and-accepted-calls` driver: `spawnSync git ENOBUFS (stdout or stderr buffer reached maxBuffer size limit)`. The implementer's branch and evidence were intact; the failed driver never ran.

Located cause: `lib/reconcile/refresh.ts` merges the newer collector into the successor through `lib/reconcile/checks.ts`'s `execFileSync` helper with its default buffer. A disposable detached checkout of implementer `d0e0b44e071c65e395365d203e2146ef04e17861`, merged with collector `425a2f57bd8dadcdc85f144827e6bba85b2aadc1` using the same merge arguments and a 64 MiB diagnostic buffer, succeeded with 1,147,127 bytes of stdout. Most was merge diffstat/create/delete summary from intervening repository gardening. This exceeds the default 1 MiB buffer; it is not a product or merge-conflict failure.

Workaround applied to Common Concept's shared repository config: `git config --local merge.stat false` (previously unset). The same merge with the default buffer then succeeded with 575 bytes of stdout. Both disposable worktrees were removed, no branch or process retained. The handler retries drive with unchanged acceptance; normal successor refresh carries both histories.

Recommendation: suppress merge summaries in automatic successor refresh (`--no-stat`), rather than requiring a repository config workaround. Also inspect failure cleanup: `newThread` reports partial resources cleaned, which was true here, but a worktree creation that itself throws before `owned = true` may not be removed. That latter case was not observed in this encounter. No source fix or test was attempted by the tracker-only exception handler.
