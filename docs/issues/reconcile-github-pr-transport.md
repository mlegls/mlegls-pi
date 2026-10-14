---
stage: "done"
assignee: "agent:technical"
author: "session:01a13a33-2a17-714d-a4b1-0ff4fb53f8f0"
part-of: "[[projects/mlegls-pi/issues/land-reconciled-trees-through-pull-requests]]"
blocked-by: []
priority: 2
---
# Deliverable

Fill `lib/reconcile/pr-host.ts:createPullRequestHost` against the committed `lib/reconcile/pr-types.ts:PullRequestHost`. This is the GitHub transport for either tracker; it does not schedule workers or change the landing ledger. Use the existing project `gh` authentication (no new credential store). `lib/tracker.ts` is the synchronous subprocess precedent, `lib/reconcile/checks.ts:git` the bounded-output Git precedent.

## Edit contract

Own `pr-host.ts` and transport-private helpers beside it. Keep the shared types' meaning. `project(cwd)` reads `gh repo view --json nameWithOwner,defaultBranchRef`, resolves a matching local git remote (prefer matching origin, otherwise the sole matching remote), and captures that repository's default base branch. Ambiguous/missing remote or authorization is an actionable failure, not a guessed target.

Use `gh api` REST/GraphQL or equivalent `gh pr` structured JSON:
- `find` queries PRs for the exact repository/head branch in all states. Recover the same PR after a create-before-save interruption; do not replace a closed PR with a new one. Refuse ambiguous matches.
- `create` sends the caller's exact head/base/title/body; `observe` returns PR state, head/base OIDs and names, mergeability, merge commit/time, all submitted reviews and all review threads/comments. Ignore pending reviews. Paginate connections, including nested thread comments; issue and review identities are opaque strings.
- `checks` and snapshot checks combine check runs and legacy commit status contexts on the exact OID. Use the latest run/context for reruns, not superseded failed attempts. Normalize GitHub successful conclusions (success/neutral/skipped) to pass, unfinished/queued to pending, failed/cancelled/timed-out/action-required/error to fail. Unknown/incomplete observation must not become empty/passed. Include actionable URLs/details; a genuine empty set is meaningful. No named-check allowlist.
- `merge` invokes merge-commit merging with an expected-head guard (`gh pr merge --merge --match-head-commit <oid>` or equivalent). Never enrol auto-merge, squash, rebase or force-push.
- `reply` adds a GraphQL review-thread reply containing the supplied durable marker. Observe existing thread comments first: finding that marker is a successful replay, so a post-before-save retry cannot duplicate it. Replies do not resolve someone else's thread.

The optional `Tracker.githubIssue(slug)` seam in `lib/tracker.ts` belongs to the GitHub tracker backend. This transport does not guess numbers from logical slugs or add a tracker CLI verb. Vault adapters omit the capability.

## First use and acceptance

Prepare a disposable repository owned by this drive (or a specifically supplied scratch fork), with a remote, default branch and the harness's existing GitHub identity. Readiness: `gh auth status`, repository access, and successful fetch of the default branch. Record its identifier and cleanup instructions; never probe a production run by creating or closing its PRs. From a one-off Bun probe, call the library host to create a scratch PR, find it again, observe it, enumerate an empty and a reported check/status, and close it through ordinary GitHub controls. Capture exact commands and structured observations under `docs/attachments/reconcile-github-pr-transport/index.md`; distinguish live API evidence from seeded transport fixtures. Thread reply and guarded-merge end-to-end evidence is owned by `rehearse-reconciled-github-pr-landings` after the lifecycle is connected.

Acceptance: host returns the complete typed observation; interrupted-create lookup identifies the existing PR; no-check observation is distinguishable from an API failure; the transport preserves the caller's body/base/head and uses only guarded merge commits. Run `bunx tsc --noEmit` and relevant existing reconciler/tracker tests. No new retained tests are authorized; one-off scratch probes and the later rehearsal are the acceptance machinery.

## Result

done

The review is complete, and all four stories hold on my final head, `e03a1f6e`. I found and repaired one defect. `bunx tsc --noEmit` is clean and `bun test lib/reconcile` passes (13 tests, 0 failures).

**Defect repaired.** `observe` returned comments from an unsubmitted (pending) review inside threads. That is a private draft, and the ticket says to ignore pending reviews. `lib/reconcile/pr-host.ts` now skips pending comments and drops threads that have none left. Live check on PR #3: with a pending inline comment, `observe` gave `reviews: []` and `threads: []`; after submitting, it showed one `COMMENTED` review and one thread.

**Check runs, which the driver had not exercised live.** I added two Actions workflows to the scratch repo, each with a job named `build`; one always fails.
- **Same-named jobs:** `checks` returned two separate `build` entries, one `fail` and one `pass`.
- **Rerun:** after rerunning the failing workflow, `checks` still returned one entry per workflow, using the newer attempt.
- **Reply replay:** calling `reply` twice with the same marker posted one comment. GitHub files a reply under its own new review id.

Everything is appended to `docs/attachments/reconcile-github-pr-transport/index.md`. PR #3 is closed; the scratch repo, branch `review-checks-probe` and PRs #1–#3 are retained. My temp clone is removed and nothing is running.

```yaml
commit: e03a1f6e
stories:
  - {story: "Exact create inputs and interrupted-save lookup", outcome: held}
  - {story: "Typed observation and empty checks versus API failure", outcome: held}
  - {story: "Latest reported status replaces superseded failure", outcome: held}
  - {story: "Closed PR remains discoverable", outcome: held}
evidence:
  path: docs/attachments/reconcile-github-pr-transport/index.md
  visual: false
  shots: []
tests: []
filed: []
fixed:
  - "e03a1f6e pending review comments no longer leak into observed threads"
caveats:
  - "A submitted review whose commit is null (for example after a force-push removed it) makes observe throw rather than guess. I left this strict, and landings never force-push."
  - "The reply and guarded-merge calls are exercised live only for reply replay on PR #3; the guarded merge itself is still owned by the lifecycle rehearsal."
  - "A reply posted through the host creates its own review id. The lifecycle should not mistake that for reviewer feedback; it is a COMMENTED review authored by the gh login."
  - "Retained tests are unchanged, and I added none."
```

Evidence: [docs/attachments/reconcile-github-pr-transport/index.md](docs/attachments/reconcile-github-pr-transport/index.md)
