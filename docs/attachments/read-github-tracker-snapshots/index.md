# Read GitHub tracker snapshots

Nonvisual first use, 2026-10-15. Adapter and runnable controller revision: `ae76cd94` (on base `ddf33da7`). This packet contains no private issue bodies or raw API dumps. Tracker selection and mutations remain intentionally inactive/unimplemented for the next serial children.

Independent user-surface replay: [driver predictions, observations and checks](drive.md).

## Setup and entry point

From this package checkout after `mise run setup`:

```sh
bun docs/attachments/read-github-tracker-snapshots/reader.ts fixture
bun docs/attachments/read-github-tracker-snapshots/reader.ts live /Users/mlegls/dev/arkhai/webapp --expiry
```

- Required environment: Bun, Git, and ordinary authenticated `gh` with read access to the private target. No server, browser, deployment, new account, new repository, or remote writes.
- Prepared local target: the fixture command owns a temporary Git checkout, renamed convention table, linked worktree, synthetic response, and `gh` wrapper. It seeds six issues and 110 comments locally and removes its files on completion. Nothing ignored or worktree-local is required to reproduce it.
- Prepared live target: existing canonical `/Users/mlegls/dev/arkhai/webapp`, read-only, repository `github.com/arkhai-io/webapp`. The adapter verifies the response repository against that checkout's remote. It reads the canonical project's existing tracker/triage documents, not branch-local copies. The worker owns this package worktree, not the live project's checkout.
- Persona/authentication: existing host `gh` authentication, forwarded unchanged by the reader's transparent wrapper. No credentials are embedded in this packet.
- Readiness observed: setup completed; canonical conventions were present; the live read returned all 182 issues. Each invocation clears only this repository's local snapshot cache to establish a cold measurement, then reuses the production adapter. The live command waits 61 seconds for genuine expiry, rather than backdating the cache.
- Entry point: [reader.ts](reader.ts), which calls `getGithubTracker` directly. It prints sanitized counts and diagnostics only. `getTracker` and the normal CLI are deliberately not activated by this ticket.

## Live observations

The public `snapshot`, `fields`, `text`, scope filtering and `githubIssue` surface observed:

| Measurement | Observed |
| --- | ---: |
| Issues | 182 |
| Native OPEN / CLOSED | 69 / 113 |
| Ready / frontier | 17 / 9 |
| Native parents with sub-issues / normalized children | 18 / 129 |
| Comments / issues containing comments | 208 / 94 |
| Native open / closed blocker relations | 15 / 97 |
| Foreign-repository blocker relations | 2 |
| Native assignments / own foreign claims | 47 / 47 |
| Contracts with title and comments in YAML metadata | 182 |

Coverage: one named `TrackerSnapshot` operation uses repository issues `first:100` and `last:100`, deduplicating by node ID and requiring the union to equal `totalCount`. The accepted repository union was 182/182, not the first 100. Labels, sub-issues, blockers, assignees and comments use the same dual-end completeness check. Repository/viewer IDs, native state/stateReason, Markdown bodies, comments and relation repository identities were included. No per-issue REST request or linked-document fetch was made.

Measured request log (the wrapper records operation names, not bodies):

| Action | Additional TrackerSnapshot requests |
| --- | ---: |
| Cold snapshot followed by every contract/field read | 1 |
| Warm snapshot, fields, text, scoped snapshot and another CLI process | 0 |
| One refresh after a real 61-second wait | 1 |

The entire measured live invocation recorded exactly two operations, both named `TrackerSnapshot`.

## Private local fixture observations

These are synthetic contracts, not private production data. All five triage roles were renamed. The inventory intentionally omitted the configured needs-triage label, without breaking reads.

- Six issues were returned from both the canonical checkout and a linked worktree whose physical convention incorrectly selected Vault; the canonical GitHub convention won. A second Bun process also returned six issues without another request.
- The ready parent had omitted residual (`ownStage: null`); its ready native child had `ownStage: ticket`. The anchored fallback child joined the same tree. Human readiness remained ineligible.
- Viewer `reader` was also the native assignee on one issue. Without a durable receipt its claim remained `github:reader`, not an owned reconciler claim. Native assignment did not change the logical agent selector.
- An open foreign blocker numbered 4 remained `github-blocker: https://github.com/fixture/other/issues/4`, never local `gh-4`. The native CLOSED local blocker remained observable as `gh-3` but did not constrain readiness. Casual body mention `#4` was not a relation; the leading `Part of #1` / `Blocked by: #5` headers were.
- All 110 comments survived overlapping first/last pages, in chronological order with author attribution in the synthesized metadata. Stripping the frontmatter left exactly the native Markdown body and no comment text. Adapter extra `risk: fixture` survived. Title/comments metadata appeared in all six contracts.
- Mutating returned guards/comments did not affect the next snapshot/fields result.
- Valid fixture reads, scopes, contracts and a second process made one initial request and zero warm additional requests.

Each malformed candidate refused the entire projection:

| Candidate | Observed diagnostic excerpt |
| --- | --- |
| Partial GraphQL data plus errors | `GraphQL observation failed: synthetic partial failure` |
| Repository pages with declared count 201 | `fixture/tracker.issues: incomplete connection: 6/201 unique nodes` |
| Nested comments with declared count 201 | `fixture/tracker#2.comments: incomplete connection: 110/201 unique nodes` |
| Both configured readiness roles | `gh-1: contradictory triage states: ready-for-agent, ready-for-human` |
| Dependency self-cycle | `gh-2: blocked-by cycle` |
| Missing native local parent | `missing/inconsistent native parent .../issues/88` |
| Invalid JSON | `invalid JSON response` |
| Missing role mapping | `missing mapping for needs-triage` |

Incomplete-connection diagnostics also direct the caller to extend the single-operation query plan or reduce the connection before retrying; they never silently dispatch a truncated graph. This fixed-page implementation does not claim support beyond 200 unique nodes per required connection.

## Regression checks

```sh
bun test lib/reconcile
bun test skills/enabled/all/mlegls/conventions/tracker/scripts
bunx tsc --noEmit
```

Observed: reconciler 14 pass / 0 fail (166 assertions); tracker scripts 24 pass / 0 fail (681 assertions); TypeScript clean. No retained suite additions or altered assertions. The one-off reader is first-use machinery, not an acceptance-test inventory.

## Private serial seam

`lib/tracker-github-snapshot.ts` exports project resolution, bounded GraphQL transport, SQLite serialization, cache loading and invalidation. SQLite releases its interprocess lock on crash; snapshot publication uses a temporary file plus atomic rename under the git-common reconcile directory. Cache freshness is 60 seconds, unrelated to HEAD, and each read yields isolated data.

`lib/tracker-github.ts` leaves `readGithubReceipt` explicitly empty for the writes child. Its `GithubReceipt.stage` distinguishes absent override, explicit ticket promotion and explicit null delegation; native triage/state still gates execution. Claim ownership must bind an exact native assignee ID to an exact durable run/attempt token. The terminal namespaced metadata envelope and receipt serialization remain backend-private and may be completed serially. Every mutation currently throws; none was attempted remotely.

No processes, browser pages, deployments or remote seed state were left running or created. The normal production snapshot cache remains under the live target's git-common reconcile state.

## Historical cursor detour in write-github-tracker-contracts review (2026-10-15)

The write review temporarily replaced the specified bounded query plan with cursor paging. The parent residual restores the first/last:100 coverage above, now checking pageInfo too; `reader.ts fixture` reads 200 nodes in one operation and refuses 201 with a locator/count. The following describes that superseded detour, not current behavior: A repository over 200 issues (webapp already has 182) now reads through cursor pages: one `TrackerSnapshot`, then `TrackerIssues`/`TrackerLabels` pages and per-issue `TrackerConnection` pages for any connection over 100, still one logical refresh under the repository lock; every drained connection must equal its `totalCount` of unique nodes or the read fails closed. `reader.ts fixture` now pages a fake server (`fake-gh.ts`) and adds a 256-issue case (operations: TrackerSnapshot, TrackerIssues ×2, TrackerConnection for gh-2's 110 comments); the two incomplete-connection diagnostics now read `incomplete connection: 6/201 unique nodes` without the old remediation hint. Priority is read from `p1|p2|p3` labels (no deferral).
