# Independent direct-adapter drive

## Predictions before first use

Revision e27ee20764530236aba8f6c9aa3e8ea2d6935feb. I have read the ticket and encounter guide, not implementation, encounter source, tests or fixtures.

- Create/update: runnable entry should return actual gh identities, preserve omitted text and unrelated native content, round-trip metadata and empty text, and reject invalid writes.
- Ownership/refinement: lost-response provisional creation should be parented and assigned immediately, rediscovered without duplicates, adopted by exact token, and stably reserved. Same-login foreign/baseline issues must survive attempted removal.
- Stage/cache: explicit ticket and residual omission should survive process boundaries; successful writes should invalidate the warm snapshot once.
- Cleanup: production discard should terminate with NOT_PLANNED detached descendants, excluding removed identities.
- Completion/move-out: already closed issues should receive exactly one reviewed result with pinned or explicitly inline evidence; only resolved blockers and owned assignment should be released. Human routing should use renamed mapping.

## Independent observed results

2026-10-15: encounter completed exit 0 in 8m42s. All predictions above met through the documented public-adapter encounter. No source/tests/fixtures inspected; no regression suites run by this driver.

- Native relationships: parent gh-56 database ID 5861293919; baseline gh-57; blockers gh-58/59 and outside dependent gh-60. Native endpoints accepted relation operations.
- Updates: fields/text/body-only/empty/null, immutable provenance and stage round-trips held. Warm fields/text caused zero snapshot requests; first post-write read caused exactly one.
- Lost-response provisional gh-61 recovered without duplicate; exact-attempt adoption held. Baseline gh-57 and same-login foreign gh-62 protected before owner cleanup.
- Production discard terminated after lost detach; gh-63/64/65 were removed NOT_PLANNED descendants/dependent. Lost-unassignment gh-66 remained removed and replay finished.
- Auto-closed gh-58 received one reviewed result; resolved outside dependency removed while unresolved blocker and guard survived. moveOut role/reason/assignment behavior held.
- gh-67 published exact-commit evidence at a6de89ae86642bd61321974c8a2b2e9c2016b068; gh-68 used explicit attachment-decline inline content. No public run/attempt tokens found by encounter.
- Independent post-run GitHub API check: all 13 owned issues gh-56..68 CLOSED and unassigned; gh-58/67/68 COMPLETED, remaining issues NOT_PLANNED. Result gh-58 has exactly one comment, ID 6186041380, marker result:56132502a880c6efc0851b771ddd99b3e0e192a3b489b138e5bc968814aad202.

### Expectations, friction and replayable checks

All six pre-use predictions met. No product friction observed. The entry is a silent long-running API encounter between coarse checkpoints; runtime was 8m42s, not a setup failure. Its temporary directory remained after success; driver removed the exact owned directory after recording observations. No server/browser/tunnel started.

Replay: run the documented entry against the authorized target; accept only exit 0 with native readiness before seeding, cache counts 0 then 1, no duplicate after lost create, terminating discard, preserved baseline/foreign during protection checks, and single-comment close replay. Independently query `/repos/mlegls/reconcile-pr-transport-20261014-35767b2d/issues?state=all&per_page=100` for the printed owned numbers: all must end closed/unassigned. Query issue 58 comments to inspect the exact result marker above. Do not mistake final owner cleanup of the foreign fixture for failed protection during refinement.

## Setup readiness

Kind: direct-adapter live API encounter. Authorized target: private mlegls/reconcile-pr-transport-20261014-35767b2d only. Auth: existing gh login mlegls. Independent preflight observed issues enabled, exact owner/name, private visibility and ADMIN access. Entry creates owned temporary clone/config and disposable marked issues; no inherited deployment selectors are reused. Setup completed per harness notification. Entry: `bun docs/attachments/write-github-tracker-contracts/encounter.ts`.
