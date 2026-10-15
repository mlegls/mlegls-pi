---
stage: done
assignee: agent
author: session:01a12f4c-1aa6-75fe-9c2b-d81acad80dbd
part-of: "[[projects/mlegls-pi/issues/reconcile-github-tracked-projects]]"
blocked-by: [ "[[projects/mlegls-pi/issues/reconcile-against-a-global-tracker]]" ]
priority: 2
---

A GitHub backend for the `Tracker` interface of [[projects/mlegls-pi/issues/reconcile-against-a-global-tracker]], over the model in [issue-tracker-github](../../skills/enabled/all/mlegls/conventions/tracker/references/issue-tracker-github.md): sub-issues for part-of, native `blocked_by` dependencies, assignees.

decisions:
- 2026-10-14: support the mattpocock/skills GitHub convention as used in simple-compute-market and webapp (`docs/agents/issue-tracker.md`, `docs/agents/triage-labels.md`): `wayfinder:map` + sub-issues, `wayfinder:<type>` children, native `blocked_by`, triage roles mapped through the repo's `triage-labels.md` table, not hard-coded label strings (maintainer).
- 2026-10-14: a run claims an issue by assigning it (the convention's claim: `--add-assignee @me`); the convention's frontier already drops assigned issues. Which run holds it lives in reconciler state (maintainer).
- 2026-10-14: refinement creates children during a run as on the vault, in every repository, no per-repo difference. No node may decrease in effective readiness: a refine may not add a child less ready than the node it refines. `lib/reconcile/refinement.ts` already refuses a refinement that lowers the effective stage, through the Tracker interface, so the GitHub backend inherits it (maintainer).

- 2026-10-14: no `stage:spec` label; stages are inferred from the convention as mattpocock's `to-spec` / `to-tickets` write them. A `ready-for-agent` issue with sub-issues is a partitioned spec and its sub-issues are tickets; a `ready-for-agent` issue without sub-issues enters as a spec, and refine either partitions it or promotes it to a ticket (`refinement.ts` already allows ticket promotion without children) (maintainer).
- 2026-10-14: the issue body (with comments) is the contract. No special support for OpenSpec or other linked documents: an agent that finds the body pointing elsewhere reads that document itself (maintainer).

- 2026-10-14: issue identity is `gh-<number>` in handles, state file names and dispatch records; a run touches one repository (maintainer).
- 2026-10-14: `drive: none` is a `no-drive` label, set by refine. Move-out removes `ready-for-agent`, adds `ready-for-human` with a comment giving the reason, and unassigns the run (maintainer).
- 2026-10-14: evidence stays committed under `docs/attachments/` on the branch; the closing comment links it. A repository whose `docs/agents/issue-tracker.md` declines attachments gets the evidence in the closing comment instead (maintainer).
- 2026-10-14: one GraphQL query per run snapshot (sub-issues, blockedBy, labels, assignees, bodies), cached between ticks, refreshed after the reconciler's own writes or after about a minute, against rate limits (maintainer).
- 2026-10-14: webapp is the first real user (maintainer).

- 2026-10-15: "one GraphQL query per refresh" means one complete logical snapshot per refresh. Cursor pages inside a refresh are allowed and required; a single aliased query that caps connections (first+last) is not (supervisor, maintainer-approved rate-limit design; webapp already has 182 issues).

The backend lives behind the existing `Tracker` interface and implements the same CLI verbs (`snapshot`, `text`, `fields`, `create`, `update` with optional body, `close`, `remove` as close-as-not-planned since GitHub deletion needs admin), selected when the project has no `docs/issues/` and its `docs/agents/issue-tracker.md` names GitHub. Triage roles come from the repository's `docs/agents/triage-labels.md` table. Blocked-by uses native dependencies, falling back to a `Blocked by: #n` body line where the convention says so; part-of uses sub-issues, falling back to `Part of #n`. Under a PR landing, the PR body carries `Closes #…` for every node in the tree; nodes still close only after the merge is proven, as on the vault.

acceptance: on the private scratch repository mlegls/reconcile-pr-transport-20261014-35767b2d (reuse it; create no other repositories), with GitHub issues: a `ready-for-agent` spec with two sub-issue tickets, b blocked by a, and an outside issue blocked by a.
- reconcile in `pr-merge`: claims by assignment, b starts after a lands in the collector while GitHub shows both open, one PR whose body closes the spec and both tickets, and after merge a, b and the spec are closed child-first with an evidence-linked comment and the outside issue unblocked.
- a `ready-for-agent` issue without sub-issues is refined into either sub-issue tickets or a ticket; a refine that fails leaves its provisional sub-issues closed as not planned.
- snapshots make one complete logical snapshot per refresh across a run; cursor pages within it are allowed and every request is counted in evidence.

## Execution shape (2026-10-15 refinement)

Serial backend construction, then activation and one live crossing rehearsal:
1. [[projects/mlegls-pi/issues/read-github-tracker-snapshots]] — direct factory/read model, convention parser and shared one-operation snapshot cache.
2. [[projects/mlegls-pi/issues/write-github-tracker-contracts]] — native writes, exact private run/attempt receipts, promotion/delegation, replayable provisional creation/removal, result evidence and move-out.
3. [[projects/mlegls-pi/issues/activate-github-tracker-in-reconcile]] — canonical selection, existing CLI verbs, root/node claim-before-launch, run context and short instructions.
4. [[projects/mlegls-pi/issues/rehearse-github-tracked-reconcile]] — actual native issue tree through pr-merge, leaf promotion/restart, failed provisional cleanup and per-refresh query counts in the authorized scratch repository.

Shared stubs: commit `29ffb775` adds `lib/tracker-github.ts:getGithubTracker(cwd, options): Tracker | undefined`, `TrackerOptions.run` and optional `Tracker.moveOut(slug, reason)` (like existing githubIssue, absent on the vault). No active factory calls the new stub until the first two children fill it. Backend implementation files are owned serially; activation owns current factory/CLI/reconciler and instruction call sites. Existing `schedulingView`, refinement acceptance and target-landing proof remain the mechanisms.

Engineering closure: use a backend-owned companion in git-common reconcile state for run ownership and explicit promotion/delegation, avoiding stale main-state saves. Native assignment alone, even @me, is not exact run authority. A provisional native create supplies parentIssueId and assigneeIds together; a prewritten intent plus an opaque generated correlation marker permits response-loss recovery without publishing the claim token. Logical extra metadata may use a namespaced hidden body envelope; title/body/comments remain the worker's full contract. Generated comments belong in synthesized contract frontmatter so generic body replacement does not copy comments into the issue body.

Each refresh produces one complete logical snapshot under the shared repository lock. Start with the named TrackerSnapshot operation, then follow cursor pages for repository issues/labels and all required nested connections until node-ID coverage equals totalCount. Check pageInfo/cursor progress and refuse inconsistent or partial graphs; do not cap connections with first/last aliases. Live webapp has 182 issues across all states and must keep working as it grows beyond 200. The children measure cache hits, expiry, own-write invalidation and every cursor request through the production transport, grouped by complete refresh.

## Located precedent and setup

Read-only research, 2026-10-15:
- [webapp tracker](https://github.com/arkhai-io/webapp/blob/a0afd4b5205d6caa2257e4c141e8901124d66df9/docs/agents/issue-tracker.md) and [triage table](https://github.com/arkhai-io/webapp/blob/a0afd4b5205d6caa2257e4c141e8901124d66df9/docs/agents/triage-labels.md). Repository is arkhai-io/webapp, not mlegls/webapp. Table columns are Label in mattpocock/skills, Label in our tracker, Meaning; canonical role is the first column. Both deployed tables currently map the five roles to identically named labels, but code reads the table. webapp's actual inventory currently lacks needs-triage; do not require every configured role label to exist merely to read an otherwise valid issue.
- [simple-compute-market tracker on dev](https://github.com/arkhai-io/simple-compute-market/blob/0ed473cae366100bb2ad6d82b47d52af111734cd/docs/agents/issue-tracker.md); its default branch lacks these tracker documents. Its OpenSpec policy is not extra backend behavior: the recorded body/comments decision remains authoritative.
- [mattpocock/skills](https://github.com/mattpocock/skills/tree/49dd158d1076134a641b33efb035946536778336/skills/engineering): to-spec and to-tickets both apply ready-for-agent; wayfinder type is not lifecycle stage. The maintainer's existing inference/promotion decision above closes this ambiguity.
- Live GraphQL schema confirms Issue.parent/subIssues/blockedBy/labels/assignees/comments and CreateIssueInput.parentIssueId + assigneeIds + labelIds. GraphQL relation inputs are node IDs; deployed REST relation endpoints use numeric database IDs. blockedBy returns closed blockers too. Each connection has max first/last 100; all pageInfo/totalCount must be checked.

Scratch preflight was read-only: supplied repo is private, unarchived, main, has_issues true; existing mlegls auth has required repository permissions. Zero actual issues, ten closed PRs, ten existing labels (only wontfix overlaps the triage table). The write/rehearsal children own missing local docs, labels and issue-edge seed preparation with current-state/readiness checks; no other repo/account/credential/permission creation. Reuse the production-shell first-use precedent at `docs/attachments/rehearse-reconciled-github-pr-landings/journey.ts`, replacing its local vault with native issues, not its scheduler with a simulation.

## Residual join

After children land, check the combined adapter/CLI/pinned-code boundary and the original acceptance packet; repair only small crossing seams and make the guide's first-use command match the delivered setup. The rehearsal owns the full live acceptance, including host auto-closure versus child-first reconciler evidence publication; do not claim control over GitHub auto-close ordering or reopen merged issues to manufacture it. No additional product decisions, UI/plugin backend or OpenSpec support are delegated here. The supervisor-required focused retained test for rate-limit hold/resume inside production run(), including worker CLI failure/report preservation, is authorized in rehearse-github-tracked-reconcile; no other new retained tests are delegated here. Existing suites/typecheck remain regression gates; new one-off packet controllers are first-use machinery.

## Rehearsal retry ruling (2026-10-15)

Independent drive aa638c89 passed prepared artifact inspection but full replay failed the controller single-page preflight before launch (95 existing native issues plus ten fixture issues). This does not establish a production pagination failure. The rehearsal owns repairing replay readiness on the same preserved authorized repository and any narrow snapshot/counting seam needed for one complete logical snapshot per refresh, with complete cursor paging and every request attributed/countable within its refresh (supervisor clarification, 2026-10-15). Do not delete inherited issues/history or use a substitute repository. The rehearsal acceptance and Stories now explicitly require the supervisor real-run rate-limit hold/resume, failing worker CLI/report preservation, absence of owner exceptions/mail, and its focused retained regression. Full native acceptance remains required; historical inspection is supplementary. Retry on the kept chain, preserve prior evidence and re-drive the final revision. No completion or integration is certified by this ruling.

## Residual join handoff (pending owner-target integration)

Worker branch github-issues-as-a-tracker-backend-implement-h, evidence head 62a875ed; production/setup tested at 9a6ea956. Committed CLI pin propagation across run() -> BB launch.env -> real bb-pi bridge repaired in 005a8454. The bounded first/last alias detour is reverted; complete cursor paging and the 256-issue/110-comment fixture are restored under the dated logical-refresh decision above.

[Final residual-join packet](../attachments/github-issues-as-a-tracker-backend/index.md): native replay passed in the authorized scratch repository, PR #137 merged with fetched ancestry, child-first saved-result/evidence publication (not a claim of host auto-close ordering), outside dependent unblocked, promotion/restart and exact provisional discard held. Both production run() rate-limit holds preserved worker failure/report state, made zero GitHub requests and raised no owner mail/exceptions. All 44 logical refreshes were complete/minimal: 88 counted snapshot requests, zero orphan pages, up to 129 native issues. Above-200 coverage is fixture evidence, not a live size claim. Existing focused regressions and typecheck passed. All owned workers stopped/retired; supplied history and disposable local inspection area retained, inventory in packet.

Entry: bun docs/attachments/rehearse-github-tracked-reconcile/journey.ts run (existing mlegls gh authentication; only mlegls/reconcile-pr-transport-20261014-35767b2d). Read-only pin entry: bun docs/attachments/github-issues-as-a-tracker-backend/pin.ts. Parent owns integration and independent acceptance; this handoff does not close the global ticket.

## Result

done

The collector merge is committed as `c3838e65`. The review note is `f17aa788`. Typecheck is clean and the reconcile and tracker tests pass. I did not re-run the live scratch-repository replay on the merged head.

- **Conflict:** `view()` in `lib/reconcile/reconcile.ts` had two edits. The worker side keyed collector progress by its logical issue (`logicalInto`). The collector side added `inherited` landings, which count a landing into an enclosing collector once the destination contains its head. I kept both and computed `inherited` against `logicalInto`.
- **Supervisor constraint:** a5d3b214 is still in the history, but 9a6ea956 reverts its snapshot change. Net to f802ab0c, the only changes in `lib/tracker-github.ts` are a comment and the CLI pin fix in `lib/thread/bb.ts`. Cursor paging is back, with the 256-issue, 110-comment fixture in `lib/tracker-github.test.ts`. The dated logical-refresh decision is already in the spec.
- **Checks:** `bunx tsc --noEmit` is clean. `bun test lib/reconcile lib/tracker` gave 30 pass, 1 skip, 0 fail. The skip is "CLI snapshot parity against selected project vault". There is no `test:affected` task in this project, so I ran those directories directly. Setup ran after the merge.
- **Not re-run:** the live replay. The merge only touches scheduling for collector landings, which `scheduling.test.ts` and `landing.test.ts` cover.

```yaml
commit: f17aa788
stories:
  - story: Native tree through collector and proven PR merge
    outcome: held
  - story: Promotion/restart and failed provisional cleanup
    outcome: held
  - story: Complete cached snapshots and rate-limit report preservation
    outcome: held
evidence:
  path: docs/attachments/github-issues-as-a-tracker-backend/drive.md
  visual: false
  shots: []
tests:
  - lib/reconcile/scheduling.test.ts
  - lib/reconcile/landing.test.ts
  - lib/tracker-github.test.ts
filed:
  - docs/issues/native-rehearsal-status-fails-after-completion.md
caveats:
  - "Live replay not re-run after the collector merge; the merged change is covered by the scheduling and landing tests."
  - "Above-200 coverage is fixture evidence, not a live size claim."
  - "No new tests added and no kept-test assertions changed."
```

Evidence: [docs/attachments/github-issues-as-a-tracker-backend/drive.md](docs/attachments/github-issues-as-a-tracker-backend/drive.md)
