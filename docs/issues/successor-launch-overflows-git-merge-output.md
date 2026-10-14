---
stage: done
assignee: agent
priority: 2
author: "session:6df456dd-f50e-4712-b604-7a873689d1d7"
---
Done: automatic successor refresh merges with `--no-stat` (in `lib/reconcile/refresh.ts`), and `lib/reconcile/checks.ts`'s `git` helper sets a generous `maxBuffer` (e.g. 64 MiB) so no reconciler git call fails with ENOBUFS on a large repository; a test exercises a merge whose diffstat would exceed 1 MiB, or at least asserts the arguments. Also check `newThread`'s cleanup when worktree creation throws before `owned = true` and fix it if it leaks.

Common Concept's `serve-the-tutor-to-agent-harnesses-over-mcp` reconciler failed launching the `show-harness-session-clients-and-accepted-calls` driver: `spawnSync git ENOBUFS (stdout or stderr buffer reached maxBuffer size limit)`. The implementer's branch and evidence were intact; the failed driver never ran.

Located cause: `lib/reconcile/refresh.ts` merges the newer collector into the successor through `lib/reconcile/checks.ts`'s `execFileSync` helper with its default buffer. A disposable detached checkout of implementer `d0e0b44e071c65e395365d203e2146ef04e17861`, merged with collector `425a2f57bd8dadcdc85f144827e6bba85b2aadc1` using the same merge arguments and a 64 MiB diagnostic buffer, succeeded with 1,147,127 bytes of stdout. Most was merge diffstat/create/delete summary from intervening repository gardening. This exceeds the default 1 MiB buffer; it is not a product or merge-conflict failure.

Workaround applied to Common Concept's shared repository config: `git config --local merge.stat false` (previously unset). The same merge with the default buffer then succeeded with 575 bytes of stdout. Both disposable worktrees were removed, no branch or process retained. The handler retries drive with unchanged acceptance; normal successor refresh carries both histories.

The endpoint successor `serve-authenticated-stateless-mcp-for-authoring-drive-n` also failed with the same launch error. Its handler verified the workaround independently: implementer `4b126f4a49a35c10963743772106e90baf2eb0a0` merged collector `425a2f57bd8dadcdc85f144827e6bba85b2aadc1` in a disposable detached checkout with `merge.stat=false`, the reconciler's exact arguments and the default buffer. It succeeded with 73 bytes of stdout and no unmerged files; the checkout was removed. Retry independent drive, retaining the implementation and unchanged product acceptance.

Recommendation: suppress merge summaries in automatic successor refresh (`--no-stat`), rather than requiring a repository config workaround. Also inspect failure cleanup: `newThread` reports partial resources cleaned, which was true here, but a worktree creation that itself throws before `owned = true` may not be removed. That latter case was not observed in this encounter. No source fix or test was attempted by the tracker-only exception handler.

## Drive evidence

[Independent runner encounter](../attachments/successor-launch-overflows-git-merge-output/index.md): 13 passing cases at `6289fc1`; merge suppression and output above 1 MiB held at the supplied regression surface. Pre-ownership worktree-creation failure cleanup remains unobservable in the runner output and requires reviewer confirmation under this ticket. Ticket remains open.

## Result

done — the change holds on head with no repairs needed. The pre-ownership cleanup case the driver couldn't observe now holds under fault injection.

The cleanup case, which I checked by fault injection: I used a repo with a required smudge filter that fails. `git worktree add -b boom` creates the branch, then fails at checkout. I drove that through the real `newThread`.
- **Base `a52c3e82`:** the error said "Partial resources cleaned" but branch `boom` remained, so the message was false.
- **Head:** the worktree path, the branch and the worktree registration are all gone. A nonexistent `base` also leaves nothing behind.

The other two stories held on the runner. `bun test lib/reconcile/refresh.test.ts lib/thread/runtime.test.ts lib/thread/lifecycle.test.ts` gives 13 pass, 0 fail. The new test traces `merge --no-edit --no-verify --no-stat` with `merge.stat=true` set, and merges a 2 MiB file through the 64 MiB-buffer `git` helper. I read the diff of `6289fc1f` and did not run the full suite or `test:affected`.

I appended the review to the committed packet and committed it as `4fd8f284`. The fault-injection script was a scratch file, not committed. No new tracker frictions turned up, so nothing was filed.

```yaml
commit: 4fd8f2848c1a58b16a63c21741683067cf16c103
stories:
  - story: Successor merge suppresses diffstat
    outcome: held
  - story: Reconciler git accepts output above 1 MiB
    outcome: held
  - story: Pre-ownership worktree creation failure cleans resources
    outcome: held
evidence:
  path: docs/attachments/successor-launch-overflows-git-merge-output/index.md
  visual: false
  shots: []
tests:
  - lib/reconcile/refresh.test.ts
filed: []
caveats:
  - "Cleanup is verified by a scratch fault-injection test, not a retained one. The partial-checkout branch leak is not covered by a retained test; proposed test: newThread removes the branch and worktree when `git worktree add` fails after creating them (lib/thread/runtime.ts). Needs maintainer approval."
  - "Residual, not observed: the registered-worktree check compares the raw `git worktree list` path with `location.cwd`. A symlinked project path would fall to the `rm` branch and leave a stale registration."
  - "Cost: the 64 MiB maxBuffer lets a runaway git call hold up to 64 MiB in memory."
```

Evidence: [docs/attachments/successor-launch-overflows-git-merge-output/index.md](docs/attachments/successor-launch-overflows-git-merge-output/index.md)
