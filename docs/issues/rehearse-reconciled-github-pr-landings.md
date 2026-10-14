---
stage: "ticket"
assignee: "agent:technical"
author: "session:01a13a33-2a17-714d-a4b1-0ff4fb53f8f0"
part-of: "[[projects/mlegls-pi/issues/land-reconciled-trees-through-pull-requests]]"
blocked-by:
  - "[[projects/mlegls-pi/issues/reconcile-submitted-pr-reviews]]"
claimed-by: "reconcile:land-reconciled-trees-through-pull-requests"
priority: 2
---
# Deliverable

Provide and drive a repeatable, owned scratch-GitHub first-use rehearsal of the completed PR landing lifecycle. This ticket owns setup machinery and durable evidence, not an alternative reconciler. Mirror `docs/attachments/reconcile-with-global-tracker-and-landing-ledger/ledger.ts` for private board/registry/agents/XDG state and deterministic shell phase workers; route through production start/run/state/host operations. Hooks remain enabled. No paid model calls or production tracker/branches.

## Edit contract and setup

Own `docs/attachments/rehearse-reconciled-github-pr-landings/` (small runnable Bun/controller scripts plus index and selected evidence) and a concise `docs/guide/reconcile-pull-requests.md` written from actual first use. The guide covers committed `.pi/reconcile.json`, tool land option and CLI --land, mode capture/resume, PR URL/status, owner exceptions, merge/deployment consequence, and clean/base-only owner ff. Read docs/verification-evidence.md in full.

First use requires an explicitly owned disposable GitHub repo or supplied scratch fork, git push rights and Actions/check reporting, the harness's normal GitHub identity, and a distinct authorized human/reviewer identity for submitted reviews and human merge. Confirm those identities can perform the required operations without printing credentials. Preflight gh auth/repo access, fetched default base, and Actions availability before starting. If reviewer credentials/actions are unavailable, request the missing human action/setup and end blocked/needs-input rather than substituting a seeded review as live acceptance. Use existing identity securely; do not create user accounts/tokens or broaden permissions.

Seed a vault spec root with two ticket children a/b (b blocked by a) plus an outside dependent, a real PR workflow whose check intentionally fails until the repair changes a located fixture file, and a minimal mise setup/pre-integrate gate. Deterministic shell workers publish ordinary structured reports with committed evidence, and repair code according to the observed check/review request. The real reconciler launches, integrates, gates, retires, publishes and closes. Controls can pause/release observations or human actions, but may not manually edit reconciler ledger to make claims pass. All fixture work is confined to the scratch repository. Record cleanup ownership; close leftover scratch PRs and stop exact owned processes. Delete only resources this ticket created or explicitly supplied for disposal.

Run both modes with the same two-ticket shape:
1. pr-merge: a lands in collector and unlocks b while global issues/outside dependent remain open/blocked; root produces one PR and leaves owner code unchanged while waiting. Deliberately failing real reported check yields a bounded repair worker. After green, merge is a merge commit, all nodes close child-first with preserved evidence, outside becomes ready, clean owner on base ff advances.
2. pr-review: submit a real changes-requested review with at least two inline unresolved threads. One repair from current branch pushes gated changes and replies on each thread. A second later changes-requested submission produces an owner exception, no automatic second repair/merge. Resolve/acknowledge through the public resolution surface and have the authorized person merge; nodes close only then. Include a comment without a submitted review and an approval while waiting to show neither individual comment triggers nor reconciler merge.

While PR wait is paused, demonstrate restart by stopping only the exact reconciler PID (not explicit stop, which is a separate cleanup operation), then calling start/reconcile from saved state: same PR number, mode, branch, review cursor and original result packets; no tree replay or duplicated workers/replies. Also demonstrate a base advancement/conflict and another identity's push to the PR branch; the final branch contains both histories, no rebase/force-push, and gate evidence corresponds to the pushed head. Observe a closed-unmerged scratch PR as an owner exception. Owner-dirty/other-branch cases may be separately driven with actual git and a seeded merged host if expensive; label them, do not use them in place of the primary live modes.

Backend seam: the vault primary runs omit closing references. Exercise PR body generation with a Tracker implementing githubIssue for nonnumeric logical slugs and verify one Closes line per carried node plus unfinished parent; label this seeded capability evidence. If `github-issues-as-a-tracker-backend` is integrated, run the same scratch journey using that real adapter and native scratch issues too. Otherwise preserve the compiled capability contract for the enclosing parent's cross-backend join, and report that live backend encounter as not yet available (not a waiver of that parent's acceptance).

## Acceptance and evidence

Commit an index at the tested revision with scratch repo/PR/check/review/thread/worker/head identifiers, mode-specific predictions before contact, actions/observations, original-vs-repaired gate evidence, close ordering, restart cut and cleanup; secrets redacted. Provide the runnable entry point and separate fully automated actions from required human review/merge controls. Durable links alone are insufficient if the scratch repo will be removed: preserve the small observations establishing each claim. This is nonvisual API/CLI/git evidence unless you actually drive a rendered surface.

Both live primary journeys satisfy the parent's recorded acceptance; observed gaps stop the assignment instead of silently weakening it. Repair narrow in-scope lifecycle seams when located and re-drive; larger/new choices go through the tracker. Existing `bun test lib/reconcile`, tracker suites and `bunx tsc --noEmit` pass on the combined revision. No new retained tests are authorized; these one-off driven scripts/check fixtures are the prescribed first-use machinery, not suite additions.

## Setup exception ruling (2026-10-14)

The implement worker reports only the existing `mlegls` identity authenticated, no supplied disposable rehearsal target or distinct authorized reviewer, and no scratch resources or processes started. Both primary live journeys are unobserved because setup is missing, not failed product observations.

Escalate the setup choice to the enclosing owner/maintainer: supply an explicitly disposable repository/fork with push and Actions/check access (or explicitly authorize creation of a fresh owned scratch repository), and name an existing distinct authorized reviewer willing to submit both changes-requested reviews and an approval, push a contributor commit, and perform the final merge. Human-operated controls suffice; no credentials need be sent. The transport child's retained scratch repository is not automatically authorized for this rehearsal or disposal.

This is the setup request required by the existing contract, not a reclassification of the rehearsal ticket. Keep its stage, claim, scope and live acceptance unchanged. Do not retry blind, substitute seeded reviews/self-review, create accounts/tokens, or broaden project permissions. Resume implementation once target ownership/disposal and the reviewer actions are confirmed; preflight their access and Actions before starting. Required eventual handoff remains both live primary outcomes and their durable PR/check/review/thread/worker/head, restart and cleanup evidence.

## Maintainer acceptance reduction (2026-10-14)

The maintainer decided not to supply a distinct reviewer. This expressly supersedes the original distinct-human live review requirement and the earlier setup-exception ruling for this ticket: accept APPROVED, first CHANGES_REQUESTED repair and later changes-requested owner escalation from the committed seeded submitted-review probe evidence, combined with today's live same-account COMMENTED repair, real marker-bearing reply reviews ignored, and restart idempotency. This is an approved scope reduction, not a claim those review states were submitted live.

Reuse and keep only the supplied private scratch repository `mlegls/reconcile-pr-transport-20261014-35767b2d`; no new repository/accounts/tokens/permissions. Finish live PR #5 by resuming its production reconciler, then invoking `gh pr merge 5 --merge` separately outside that process as `mlegls`, the maintainer-authorized stand-in human merger. Verify the reconciler itself never requests merge in pr-review, observes MERGED plus fetched ancestry, closes a/b/root child-first with saved evidence, releases the outside dependent and advances the clean/base owner. Live pr-merge acceptance and the other recorded recovery/base-history claims remain unchanged. Record the live-versus-seeded boundary and retained scratch cleanup ownership in the committed packet. The worker reports done without closing this execution ticket; closure remains with the enclosing reconciler after target integration.

Authority: parent run board decision mv884mdq-xoy620, 2026-10-14 14:47:24Z, carrying the maintainer's ruling.
