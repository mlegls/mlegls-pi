# Independent drive — 2026-10-15

Revision: 755c673e2b176b56a9a4b33057fee9565568697a. Nonvisual library journey; no implementation, tests or fixtures inspected.

## Predictions recorded before first product read

1. Documented fixture entry point will expose renamed readiness roles, full body and attributed comments, canonical-checkout selection, hierarchy, closed versus foreign open blockers, and unowned native assignments through public Tracker reads. Invalid/incomplete observations will fail closed.
2. Documented live entry point will read all 182 webapp issues without remote changes and expose comments/hierarchy/blockers/readiness through the same surface.
3. Cold reads will make one TrackerSnapshot request; repeated public reads and a second process none; genuine expiry exactly one more.

## Setup and readiness

User reported mise run setup finished. Package worktree owns the invocation; shared live canonical checkout is read-only, not owned for mutation. Verified origin github.com/arkhai-io/webapp, both convention files present, existing gh authentication active. No secret values recorded. No live seeding authorized or attempted. Initial --help attempt returned usage plus a stack trace, before any product read; documented commands themselves were sufficient.

## Actions and observations

Both commands completed with exit 0:

```sh
bun docs/attachments/read-github-tracker-snapshots/reader.ts fixture
bun docs/attachments/read-github-tracker-snapshots/reader.ts live /Users/mlegls/dev/arkhai/webapp --expiry
```

### Local synthetic public-surface journey — held

Fixture reported 6 issues, 5 open/1 closed, 4 ready, 1 parent/2 children and 110 comments. Linked checkout also returned 6. Isolated projections true. One snapshot request, zero warm additional requests, second process returned 6. Native viewer assignment remained github:reader; humanEligible false; childOwnStage ticket and delegatedRoot null. Extra metadata preserved. Body preserved, comments not copied into body and chronological comments all true. Foreign blocker remained an opaque other-repository URL; closed local blocker remained gh-3.

All eight invalid observations refused projection: GraphQL partial failure, repository 6/201 incomplete, comments 110/201 incomplete, contradictory triage, dependency cycle, missing native parent, invalid JSON, missing needs-triage mapping. Incomplete diagnostics explicitly recommend reducing connection or extending single-operation query plan. Prediction 1 met through sanitized controller observations, not inspection of its machinery.

### Live read-only journey — held

182 issues (69 open/113 closed), 17 ready/9 frontier, 18 parents/129 children. 208 comments across 94 issues. Native blockers: 15 open, 97 closed, 2 foreign. 47 native assignments and 47 foreign claims. All 182 contracts had title/comment metadata. Prediction 2 met; no private bodies or raw responses retained.

### Cross-process warm cache and expiry — held

Live command measured firstRequests 1, warmAdditionalRequests 0, expiryRequests 1 after its documented real 61-second wait. Operations exactly [TrackerSnapshot, TrackerSnapshot]. Fixture independently measured initial 1, warm 0 and second-process reuse. Prediction 3 met.

## Replayable checks

- Run fixture command: accept six complete contracts, canonicalFromLinked 6, humanEligible false, viewerAssignmentClaim github:reader, bodyPreserved/commentsNotCopiedToBody/chronologicalComments/isolatedProjections true. Fail if foreign blocker aliases local gh-4 or malformed candidates return projections.
- Run live command with --expiry against stated canonical checkout: accept complete count matching current repository inventory (182 this run), title/comment contract count equal issue count, first 1/warm 0/expiry 1 and precisely two TrackerSnapshot operations. This observation does not claim future inventories above fixed-page capacity are supported.

## Frictions and limits

No unresolved in-scope product friction observed. The one-off reader lacks friendly --help output; this single failed invocation had no established journey impact and required no workaround beyond its printed/documented usage. Verification is through committed one-off reader summaries, not independent inspection of private payloads. Regression suites and TypeScript checks intentionally not rerun by driver; reviewer/integrator own those gates. No browser, server, remote mutation or new deployment. Both owned processes exited; only documented shared production cache remains. No resources need stopping.

## Review — 2026-10-15

Read the log with the diff. Existing checks on review head: `bun test lib/reconcile` 14 pass, tracker scripts 24 pass, `bunx tsc --noEmit` clean. Fixture reader re-run after the repair: same sanitized results (6 issues, 1 request, 0 warm, all eight malformed candidates refused). Live webapp not re-run: the repair cannot change it (webapp has no `p1`–`p4` labels) and its counts above stand.

Repair: removed the adapter's `p1`–`p4` label to `priority` mapping. No contract or decision specifies it, and it would make a repo's unrelated label (a) set `deferred` and drop issues from the non-explicit frontier and (b) throw on two such labels, failing the whole read. `no-drive` stays (maintainer decision). Priority from labels, if wanted, belongs to the writes child with its inverse.
