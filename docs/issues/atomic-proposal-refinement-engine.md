---
stage: "done"
assignee: "agent:technical"
priority: 2
author: "session:thr_pgxs7mv9k9"
part-of: "[[projects/mlegls-pi/issues/refinement-creates-children-atomically-on-acceptance]]"
---
Switch refinement from live provisional tracker writes to branch-committed proposals applied atomically on acceptance, strip proposal files when landing interface commits, delete the dead provisional-claim/baseline/discard/adopt machinery from the reconciler, update [refine.md](../../agents/roles/refine.md) and tracker docs, and prove crash-safe replay on a real vault tracker. Part of [[projects/mlegls-pi/issues/refinement-creates-children-atomically-on-acceptance]], meeting [[projects/mlegls-pi/issues/github-tracker-atomic-refinement-create]] at [proposal.ts](../../lib/reconcile/proposal.ts) (`369f35de`).

## shape

- Complete [proposal.ts](../../lib/reconcile/proposal.ts):
  - Read and parse `.reconcile/proposal/children/<alias>.md` and optional `.reconcile/proposal/parent.md` from a worker's committed `HEAD` (accepting logical slugs and normalizing vault wikilinks). Reject stray files under `.reconcile/proposal/`.
  - Validate the full proposal before landing for both vault and GitHub backends: valid slugs, no collisions with existing tracker slugs, no `claimed-by`, non-empty child bodies, `stage: ready` (or valid ready container with ready proposed children), eligible agent assignees, valid GitHub-compatible `priority`/`drive`/metadata without reserved fields or `<!-- mlegls-pi:tracker` envelopes, `part-of` rooted at `node`, `blocked-by` referencing existing issues, proposed siblings or opaque guards, acyclicity across `part-of`/`blocked-by`/`completion`, topological ordering of `proposal.children` (parents and blockers before dependents), parent update forbidding `part-of`/`claimed-by`/`author` edits or lowering effective stage (`stage: null` only when children exist; promotion requires `parent.md` with `decompose: false` when there are no open direct children), exact match between `handoff.children` and retained + proposed direct children, and frozen `author` populated from proposal, parent, or `reconcile:<root>`.
  - Implement `stripProposalCommits` to replay `base..HEAD` without `.reconcile/proposal/`, dropping empty commits so proposal-only refinements leave the collector's `HEAD` unchanged.
- Rewrite [refinement.ts](../../lib/reconcile/refinement.ts) around `beginRefinement`, `acceptRefinement`, and `recoverRefinements` (substantially smaller than the current 372 lines):
  - Under the tracker lock, validate the proposal and persist `phase: "accepting"` with `proposal` and `created: {}` before touching Git or the tracker.
  - Land interface commits via `integrate` with `stripProposalCommits` in `prepare` (recording `preparedHead` before fast-forward and `landedHead` after; when no non-proposal files changed, set `preparedHead = landedHead = collector HEAD` without merging).
  - Create each child in `proposal.children` order via `resolveProposedChild(child, created, "reconcile:" + root)`: skip aliases already in `acceptance.created`; on vault (`!tracker.githubIssue`), treat an existing slug with matching `partOf` and `claimed-by: reconcile:<root>` as already created before crash; on GitHub, call `tracker.create` (idempotent via create journal) and persist `acceptance.created[alias] = actualSlug` after each create. Update `acceptance.children` with `directChildrenOf`, apply `proposal.parent` if present, and mark `phase: "accepted"`.
  - Delete `discard`, `adopt`, `replaceRefinement`, `observeRefinements`, `releaseRefinementClaims`, baseline/owned tracking, and their dead helpers. Ignore historical terminal `accepted`/`removed` entries in `s.refinements`.
- Simplify [reconcile.ts](../../lib/reconcile/reconcile.ts), [main.ts](../../lib/reconcile/main.ts), and [scheduling.ts](../../lib/reconcile/scheduling.ts):
  - Remove `stopRefinementWriter`, `removedRefinement`, `refinementRecovery`, provisional-token prompt injection, `discardRefinement`/`replaceRefinement` calls, and `withheld`/`provisional` scheduling (keep `s.workerSessions` ignored claims in `scheduling.ts` and keep clearing the stable `reconcile:<root>` claim on move-out and when a node leaves the tree in `reconcile.ts`).
  - Stopping a `writing` refinement marks it `removed` without touching the tracker (leaving the tracker byte-identical); `needs-input`/`blocked` keeps the refiner alive so `answer` replies directly.
  - Leave [tracker-state.ts](../../lib/reconcile/tracker-state.ts) and `lib/tracker-github*.ts` untouched.
- Update [refine.md](../../agents/roles/refine.md) and tracker docs ([lifecycle.md](../../skills/enabled/all/mlegls/conventions/tracker/references/lifecycle.md), [issue-tracker-vault.md](../../skills/enabled/all/mlegls/conventions/tracker/references/issue-tracker-vault.md), [issue-tracker-github.md](../../skills/enabled/all/mlegls/conventions/tracker/references/issue-tracker-github.md)) to the proposal-file contract.
- Update [refinement.test.ts](../../lib/reconcile/refinement.test.ts) and [scheduling.test.ts](../../lib/reconcile/scheduling.test.ts), and add `docs/attachments/refinement-creates-children-atomically-on-acceptance/replay.ts` satisfying the parent's `## check` against a real vault tracker (two proposed children + interface commit, SIGKILL after creating the first child and restart, stopped attempt leaving tracker byte-identical, and promotion setting `decompose: false` into implement).

## Result

done

I reviewed the change directly, since drive was skipped and there was no driver's packet. Every story holds on the final head, `9375a164`. The real problem was where the two siblings meet: after the GitHub sibling (`fb9fb072`) was merged in, one GitHub tracker test failed. It passes on the sibling's own head, so the merge caused it, and I fixed it.

- **The seam break:** the engine's `resolveProposedChild` now treats a child with no `stage` as `stage: ready`. A container gets `stage: null` once its children exist. The GitHub sibling's test fixture proposed a leaf with no stage, which `readProposal` would reject anyway. So the request it built no longer matched the saved proposal, and the GitHub tracker refused the claimed create. I gave the fixture `stage: "ready"` in `428d7e5c`; no assertion changed.
- **Ticket check:** the replay `docs/attachments/refinement-creates-children-atomically-on-acceptance/replay.ts` passes in all three modes:
  - **create:** after a SIGKILL right after the first child is created and a restart, both children exist exactly once, the interface commit is on the collector and no proposal file landed.
  - **stop:** the tracker's `docs/issues` tree hash is unchanged.
  - **promote:** the refiner stays alive for `answer`, and `decompose: false` goes on to implement.
  - **Size:** `refinement.ts` went from 373 lines to 144.
- **Other checks:** the earlier mid-integrate SIGKILL replay (`replay-a-daemon-restart-mid-integrate/replay.ts`) passes. The refinement, scheduling and GitHub tracker test files pass (12 tests), and `tsc` is clean.
- **Cleanup:** removing the old provisional code had left blank lines in `reconcile.ts` and `scheduling.ts`; I dropped them in `ce15bc0e`.
- **Nothing structural:** I didn't refactor beyond the blank-line cleanup.
- **Frictions:** none were linked and I filed nothing.

```yaml
stories:
  - story: two proposed children + interface commit, SIGKILL after first child create, restart → both children exactly once with claimed-by reconcile:root, interface on collector, no proposal file landed
    outcome: held
  - story: stopped writing attempt leaves the tracker byte-identical
    outcome: held
  - story: needs-input keeps the refiner alive for answer; promotion sets decompose false and goes to implement
    outcome: held
  - story: GitHub claimed creates accept exactly the engine's resolveProposedChild output
    outcome: held
evidence:
  path: docs/attachments/refinement-creates-children-atomically-on-acceptance/index.md
  visual: false
  shots: []
tests: []
fixed:
  - "428d7e5c: GitHub acceptance fixture proposed a leaf with no stage, so it no longer matched resolveProposedChild after the merge (tracker-github.test.ts failed)"
  - "ce15bc0e: blank lines left where provisional code was removed"
filed: []
changes: []
caveats:
  - drive was skipped (no drivePaths/renderedPaths touched); this review is the only pass before integration
  - "428d7e5c changes fixture data in lib/fixtures/github-acceptance.ts (stage: ready on proposed leaves); no test assertion changed"
  - "RefinementAttempt still carries the deprecated provisional fields (tracker-state.ts is out of scope). Non-terminal legacy phases (stopping/cleaning/adopting) from a run started before this change are now ignored rather than cleaned up; that run's provisional children would show as foreign claims. Removal belongs to the parent join."
  - Tracker.remove (lib/tracker.ts, vault CLI verb, GitHub stub) has no callers left; deleting it touches tracker-github*.ts, which the ticket leaves alone, so it's left for the parent join
  - "cost: each replay.ts mode spawns a real reconciler process against a disposable vault, ~10 s per mode"
```

Evidence: [docs/attachments/refinement-creates-children-atomically-on-acceptance/index.md](../attachments/refinement-creates-children-atomically-on-acceptance/index.md)
