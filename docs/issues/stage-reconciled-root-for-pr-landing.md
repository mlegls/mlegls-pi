---
stage: "done"
assignee: "agent:technical"
author: "session:01a13a33-2a17-714d-a4b1-0ff4fb53f8f0"
part-of: "[[projects/mlegls-pi/issues/land-reconciled-trees-through-pull-requests]]"
priority: 2
---
# Deliverable

Wire per-run landing modes and a durable, run-owned PR staging checkout into the existing reconciler. Children/collectors still integrate locally; a PR run's root integrates into the staging branch, never into the owner's checkout before the PR merges. Fill only this bootstrap/target-closure slice; the next ticket fills `advancePullRequest`.

## Context and interfaces

Read `lib/reconcile/reconcile.ts` State/run/startPhase/land/cleanupLandings/tick, `completion.ts` landReviewed/recoverLandings/closeAtTarget, `main.ts` start/stop/summary, `lib/thread/lifecycle.ts:integrateThread`, `extensions/supervision/index.ts`, and `lib/reconcile/tracker-state.ts`. Integration locates the destination via the worker branch's recorded `ab-parent`, not via the integrate caller's cwd: every root/repair worker must be parented to the staging branch. The prepared-head/ancestry and close receipts are the restart precedent. Shared seams are `pr-types.ts`, `pull-request.ts:PullRequestContext`, and optional GlobalRunState land/pr/target. Existing absent land is local.

## Edit contract

Own `reconcile.ts`, `main.ts`, `completion.ts`, `extensions/supervision/index.ts`, a small `pr-config.ts` if useful, and the corresponding landing/status/inflight documentation. Preserve existing local behavior and ledger scheduling.

- Add `land?: LandingMode` to library start/run and the reconcile tool, `--land local|pr-merge|pr-review` to CLI start/run. Resolve at the first start: explicit option, otherwise `.pi/reconcile.json` as committed at the owner checkout HEAD, otherwise local. Malformed config/invalid mode fails before launching. Persist before spawning/publication; resume retains the captured mode, and refuses an explicit conflicting override. Existing saved states with no land are local even if the project's config changed. Session-start recovery uses the saved mode.
- For PR modes, use host.project to capture repository/remote/default base branch. Create a deterministic owned branch/worktree (under the existing repository worktree area), seeded from the fetched base. Persist its exact identity before creation and adopt only that identity after a crash. Exclude global tracker files just as collectors do. `s.cwd` remains the owner checkout for state/owner identity; the execution destination/view for the root is the PR staging path. All internal collector `into` slugs remain unchanged. Initial root integration uses the existing gates, tests, evidence and write-ahead protocol. Root/descendant entries transfer into staging path, not cwd, and remain globally open.
- Worker/collector cleanup after root integration keeps the independently owned staging branch/worktree. Ordinary phase workers retire while the PR waits. Explicit stop keeps the published PR branch/receipt, retires only owned workers, and never closes a PR or falsely completes issues. Extend status and inflight projection to identify the PR URL/phase/mode and pending target rather than calling staging an owner landing.
- Connect the dormant `advancePullRequest` hook after root integration and on opening/waiting/repairing restart. Supply the context callbacks via existing launch/report/retire/exception machinery; repairs launch a technical review-role worker from staging HEAD, under the same run budget, with the root contract, saved results/gates and the repair request. An opening/waiting run bypasses ordinary tree scheduling (do not rerun a ledger-satisfied root). Owner exception resolutions act on the PR receipt, not redispatch the completed children. The next ticket owns publication, polling, repair integration and trigger handling.
- Generalize completion eligibility: local still closes at cwd; PR closes only after a MERGED receipt and fetched base ancestry proof. The remote target identity is `github:<owner/name>:<base branch>`. Transfer root and carried entries there, save, then replay child-first Tracker.close with their original reviewed results. PR closure is independent of the owner's checkout being usable. After close, fetch and fast-forward that checkout only when clean and on the PR base branch; divergent/dirty/other-branch checkouts are left untouched, without reset/stash. Save ownerSync so restart doesn't repeat side effects. Never infer remote merge from local staging ancestry alone.
- PR modes do not consult the local mainRed marker. The next ticket supplies the base-check observation in its place. Do not enable the final PR lifecycle until its stub is filled; local runs and existing tests remain usable in intermediate revisions.

`advancePullRequest` must be callable with a supplied host/context for scratch observation; retain the production host as the default. This is an injection seam, not a different lifecycle.

## First use and acceptance

Mirror the isolated environment and shell workers in `docs/attachments/reconcile-with-global-tracker-and-landing-ledger/ledger.ts` (read before using): private repository, board, registry, agents and XDG state, no model calls. Do not inherit its fixture hook-disabling lines; execute hooks normally. Stage a two-ticket tree and inspect the real integration receipt before publication: collector work stays pending, root gate ran in the staging-parented worker, owner HEAD/code is unchanged, all results survive retirement/reload. Use a supplied merged host observation and an actual fetched merge commit to exercise target close; a dirty owner and an owner on another branch stay untouched. A scripted host observation is labelled seeded, not live GitHub evidence. Record under `docs/attachments/stage-reconciled-root-for-pr-landing/` with setup and runnable entry point. Full live publication/restart acceptance belongs to the later rehearsal.

Run `bunx tsc --noEmit`, existing `bun test lib/reconcile` and tracker script tests; adapt kept tests only where the deliberate mode/target behavior requires it. No new retained tests are authorized. Acceptance: absent config/local is unchanged; captured modes survive resume/config changes; PR root integration cannot close nodes or touch owner code; proven merge closes child-first exactly once logically, and optional owner ff never overwrites work.

## Result

done — the PR staging and target-closure slice holds against the ticket, with one small repair of mine. All five of the driver's stories hold on the final head.

`bunx tsc --noEmit` is clean, `bun test lib/reconcile` passes 13, and the tracker script tests pass 24. The repo has no `test:affected` task, so I ran those instead. I didn't re-run the driver's scenarios (~10 min); my change only touches `stop` when the staging path is missing.

The repair is in `lib/reconcile/main.ts`. `stop` now falls back to the owner checkout when the recorded PR staging path doesn't exist yet (for example, stopping while still `preparing`). Before, it would have used a nonexistent cwd. I appended a review note to `drive.md` and committed everything as `009ca3d2`.

I read the diff and found nothing else to fix:
- **`pick` change:** it was needed because the `technical` stance has role `implement`, but the repair worker is launched with the `review` role.
- **Inflight and status:** local output is unchanged.
- **Dormant lifecycle:** `pullRequestLifecycleReady=false` keeps publication dormant, as the ticket intends.

The driver filed no frictions, so there was nothing to triage. This isn't a join review, so there are no `changes` to report.

```yaml
commit: 009ca3d2
stories:
  - {story: Captured modes and resume/refusal behavior, outcome: held}
  - {story: Staging-only root landing preserves owner and pending results, outcome: held}
  - {story: Retirement/reload preserves staging receipts, outcome: held}
  - {story: Proven merge closes child-first without duplicate closure, outcome: held}
  - {story: Owner synchronization protects dirty/other/divergent/missing owners, outcome: held}
evidence:
  path: docs/attachments/stage-reconciled-root-for-pr-landing/index.md
  visual: false
  shots: []
tests: []
filed: []
fixed:
  - {what: "stop falls back to the owner checkout when the PR staging path is missing", commit: 009ca3d2}
caveats:
  - GitHub host observations are seeded, not live. The merge and fetch run against a private local bare remote.
  - Each case of the driver's acceptance run costs about 10 minutes for 9 worker launches, because it uses real shell workers and real integration gates. The five cases are run one after another.
  - Live publication, CI/review repairs and restart are for later tickets.
```

Evidence: [docs/attachments/stage-reconciled-root-for-pr-landing/index.md](docs/attachments/stage-reconciled-root-for-pr-landing/index.md)
