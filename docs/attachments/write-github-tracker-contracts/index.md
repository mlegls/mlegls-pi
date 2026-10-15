# Direct GitHub tracker mutations

Independent driver replay: [predictions, observations and checks](drive.md) (2026-10-15, exit 0; owned gh-56..68).

Nonvisual first-use packet. Adapter implementation: a9e12a4e, 73f70908 and e5c92d38.
The factory/CLI/reconciler remain unactivated here.

## Runnable setup

From this package checkout:

    bun docs/attachments/write-github-tracker-contracts/encounter.ts

Required and observed target: **private mlegls/reconcile-pr-transport-20261014-35767b2d**,
using existing host gh authentication as **mlegls**. No token/account/repository/permission
creation. No writes to webapp or simple-compute-market.

The entry point creates its own temporary canonical clone with an exact origin and local
tracker/triage fixture documents. It verifies authenticated login, exact repository owner,
privacy, issues-enabled and push access; introspects atomic create parent/assignee inputs;
then completes a production native TrackerSnapshot before seeding issues. Actual sub-issue
and dependency endpoints are observed after the first disposable issues exist.
The original encounter started with zero issues (closed PRs occupied numbers 1–10).

Fixture labels are explicitly prepared: encounter/triage, encounter/info, encounter/agent,
encounter/human and no-drive; existing wontfix is reused. The four renamed roles plus wontfix
form the local five-role table. These are fixture choices, not new repository convention
requirements. Unrelated labels, including documentation, are preserved.

The companion gh-wrapper.ts forwards all authentication and actual API traffic. It records
operation names only and can discard an already successful create, detach, unassignment or
comment response. It does not fabricate API responses. No credentials are recorded.

Each fresh invocation prepares its own clone/config/state and seeds only its own marked issues.
The local run JSON is a fixture for direct library use, not an active reconciler. Production
beginRefinement, observeRefinements, replaceRefinement and discardRefinement are used.
Stable acceptance is exercised with a saved ancestry receipt for an actually committed shared
stub in an owned local collector; no active worker dispatch is claimed.

## Observed encounter

The encounter records native issue IDs, correlation UUIDs and result-comment markers in its
temporary encounter.json; selected final identities are recorded below. Raw private issue
bodies and command logs are not retained in this packet.

| Action | Observation |
| --- | --- |
| Create with requested title | Actual gh-number returned; native title follows fields.title, not the returned identity |
| Native parent + assignment at provisional publication | GraphQL createIssue supplies repositoryId/parentIssueId/assigneeIds/labelIds together as node IDs |
| Native dependency / detach writes | Numeric database IDs, not issue numbers or node IDs |
| Fields-only, body-only, empty body and null updates | Extra nested metadata survives; omitted body preserved; supplied body replaces only native Markdown; empty body remains empty |
| Immutable provenance | Explicit author round-trips; changing it refuses before publishing |
| User-owned content | Unrelated documentation label, native mlegls assignment and user comment survive body/field writes |
| Invalid priority, foreign locator and parent cycle | Refused before any TrackerWrite |
| Stage promotion/delegation | ticket survives; stage:null becomes omitted residual; another Bun process reads omission from the same git-common receipt |
| Shared cache | Warm fields/text add 0 TrackerSnapshot requests; first read after a write adds exactly 1; another process reuses a warm snapshot |
| Lost create response | Child is already parented and assigned; snapshot exposes its exact attempt claim and never as an unclaimed frontier contract |
| Create replay after process restart | Separate Bun process discovers the same opaque correlation and returns the same child; issue count unchanged |
| Adoption / stable reservation | Production adoption transfers only the exact old token; committed-stub ancestry allows stable reservation |
| Baseline / foreign protection | Baseline cannot become provisional; same-login assignment without receipt stays github:mlegls; neither can be removed |
| Failed refinement | Native NOT_PLANNED nested children/dependent are detached and unassigned; production discard terminates and excludes removed IDs/counts |
| Lost native detach | Private preimage retains discoverability while the child remains assigned; discard replays the remaining removal |
| Lost final unassignment | Closed/detached issue already projects as removed; discard terminates and explicit remove replay finishes the private receipt |
| Auto-closed result | Already CLOSED issue still receives reviewed summary; lost successful comment response replays without duplicate comment |
| Outside dependent | Only the completed blocker is removed; unresolved native blocker and opaque review guard survive |
| moveOut | Agent label becomes mapped human label; reason appears once; only owned assignment/claim released; relations unchanged |
| Evidence | Published artifact links exact commit a6de89ae86642bd61321974c8a2b2e9c2016b068, never a local path/branch |
| Explicit attachment-decline fixture | Attachments: declined causes artifact content in closing comment rather than a blob link |
| Private claim tokens | No run/attempt claim token in native bodies, labels or comments |

The evidence artifact reused from the supplied repository is
docs/attachments/rehearsal/rehearsal-merge-34lwsx-a.md.
Its committed blob was checked against the exact published commit before comment publication.
The attachment-decline fixture is an explicit local convention, not inference from an alternate
directory.

## Owned final identities and API observations

All numbers below are issues in the single supplied private repository.

| Surface | Identity / observation |
| --- | --- |
| Parent / baseline | gh-39 / gh-40; parent database ID **5861137809** |
| Completed blocker / retained blocker / outside dependent | gh-42 / gh-43 / gh-44 |
| Crash-adjacent provisional | gh-47; correlation **e0f5b358-884d-4c02-823e-328543d81511** |
| Same-login foreign-assignment fixture | gh-48; still OPEN and assigned during the protected-removal assertions |
| Failed-refinement descendants/dependent | gh-49, gh-50, gh-51; native NOT_PLANNED, detached/unassigned, absent from public snapshot |
| Lost final-unassignment child | gh-53; native NOT_PLANNED, no assignment; replayed after discard |
| Published / inline evidence | gh-54 / gh-55 |
| Auto-closed result comment | gh-42 comment **6185847895**, marker result:2266209c9ad9fb0091c0b552ed8f6325ac4d2e7afe0f8585ff182f654cf24ce3 |
| Move-out reason comment | gh-47 comment **6185851593**, marker move-out:9a61d8f8faa06cb283f638a4e0e432f40b99b3dc565dd2718ec525a46b540708 |
| Published evidence comment | gh-54 comment **6185858278**, marker result:c1cb0b1a5a405e691c8ee88acb652d324bdb0ec46a288b8693ba086ad89ee834 |
| Inline evidence comment | gh-55 comment **6185862752**, marker result:e68d7061cb5bbff2a666d871945220e6dd52297b9498e81cf8f1e27da2b75dba |

Before response-loss recovery, gh-47 was natively parented under gh-39 and assigned to mlegls;
the exact first-attempt receipt was visible, with frontier:false. Another Bun process replayed the
same create and returned gh-47 without increasing the issue count. Adoption changed only the exact
private token; stable conversion retained the same native assignee. Move-out later released that
assignment and mapped its role to encounter/human, without detaching it.

gh-44 initially had native blockers gh-42 and gh-43 plus an opaque review guard. After result replay
for already-CLOSED gh-42, its native blocked_by endpoint contained only issue **43**, and the logical
fields contained gh-43 plus the unchanged review guard. The result-comment count for gh-42 was **1**.

A supplemental native reparent encounter moved the already-owned disposable gh-12 from gh-11 to
gh-13 through Tracker.update; both logical fields and the native sub_issues endpoint agreed. It then
restored gh-11. All three stayed closed.

Final repository observation after exact-owner cleanup:

    issues=45; open=0; assigned=0; not_planned=34

This includes prior owned encounter cycles and the separate alias diagnostic, not any pre-existing
user issues (there were none). Existing closed PRs and repository resources were left intact.

## Backend persistence and replay

- Native assignment plus exact private receipt defines ownership. A matching login alone never does.
- Each receipt names the exact host/repository. Run/attempt authority comes from the saved root and
  exact attempt record, not a string prefix.
- <common>/reconcile/<root>.github.json is backend-owned and separate from the reconciler's main
  JSON; caller saves cannot overwrite worker receipts.
- Repository-private promotion/delegation/removal receipts sit beside the shared snapshot cache.
  Null delegation and absent override are distinct. Current human/not-ready triage and CLOSED
  state always gate stage receipts.
- SQLite serializes cross-process receipt/cache publication and releases the lock after a crash.
  JSON publication is atomic. Every successful or uncertain write invalidates the shared cache.
- A create intent is saved before publication. Its unique remote correlation is opaque, not a claim
  token. An uncertain create with no discoverable correlation refuses to publish a duplicate.
- Update, removal, close and move-out intentions survive partial failures. Closing comments have
  stable markers; close does not reopen an already closed issue.
- Fallback relationships require both the repository's explicit fallback convention and a positive
  unsupported-capability response. 403/404, timeout, rate-limit and arbitrary validation/server
  failures do not authorize a different graph. Provisional creation still requires atomic native
  parent/assignment; it never degrades to an unclaimed or unparented publication.

## Additional diagnostic observations

- A temporary local transport diagnostic observed the anchored parent/blocker fallback and required
  map task-list entry only for explicit unsupported-capability 422 responses. The same path refused
  403/404/429/500 and arbitrary validation-422 errors without publishing fallback. No remote capability
  was disabled and no diagnostic test was retained.
- Public alias replay with reordered metadata keys returned **gh-52** again; changing that alias's
  body refused instead of publishing a second issue. Closing with reordered summary/evidence keys
  produced exactly one result comment, **6185838736**. The diagnostic issue is closed. This last
  hardening was re-driven through the public adapter and typechecked.

## Checks and cleanup

Existing regression commands:

    bun test lib/reconcile
    bun test skills/enabled/all/mlegls/conventions/tracker/scripts
    bunx tsc --noEmit
    bun docs/attachments/read-github-tracker-snapshots/reader.ts fixture

Observed regression results: reconciler **14 pass / 0 fail (166 assertions)**; tracker
**24 pass / 0 fail (681 assertions)**; TypeScript clean. The reader fixture also passed.

An intermediate encounter assertion wrongly expected a warm cache immediately after deliberately
refused writes had invalidated it. The encounter now warms that cache before measuring cross-process
reuse; the same owned target was retried, not reseeded into duplicate issues.

No retained tests were added. This encounter is disposable first-use machinery, not a suite.

Disposable issues from earlier encounter cycles were closed/unassigned by their encounter owner.
NOT_PLANNED removal outcomes and completed result comments remain inspectable; no administrative
issue deletion is used. Supplied repository, pre-existing PRs, labels and inherited resources are
retained. No browser, server, container, tunnel or remote deployment was started. Owned temporary clones,
local collector worktrees and wrapper files were removed after recording these observations;
the runnable entry reconstructs setup rather than depending on those paths.
