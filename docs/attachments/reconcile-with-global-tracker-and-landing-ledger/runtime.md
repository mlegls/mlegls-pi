# Activated global runtime: sparse first use

Tested code: activation `2a5cdc1f`, rehearsal `b0774a21`, and recovery/tests `512356a`.
On 2026-10-12 the actual production rehearsal completed with sparse, freshness,
refusal and code-only outcomes all held. This is a nonvisual CLI/library journey.

## Setup and replay

Required and prepared environment: disposable local Git repository, isolated global
Tracker, registered zmx shell workers and actual reconciler process; no model or
credentials. The script supplies one shell stance per role, seeds a spec root and
ticket child, and invokes production `main.start`, `newThread` and `integrate`.
It clears inherited BB/session/runtime identities, isolates state/board/cache/agent/zmx
directories, and uses the checkout-local Tracker CLI and prompt roster.

From any cwd, with `PACKAGE` pointing to the checkout under review:

```sh
bun "$PACKAGE/docs/attachments/reconcile-with-global-tracker-and-landing-ledger/sparse.ts"
```

The observed owned target was `/private/tmp/rc-global-sparse-MUMcuI/repo` on `main`;
worker and collector worktrees were beneath its fixture-owned `repo__worktrees`.
Readiness was observed through both completed setup-contract output and the shell
launch marker before interactions. The script stopped its run, abandoned its
remaining registered threads and removed its temporary target before returning.
Replay creates its own new owned target; no resident service or ignored setup is needed.

## Observations

| Action | Observed result |
| --- | --- |
| Actual run creates collector and owning worker; worker prepare/setup executes | `docs/issues` absent in both; `docs/attachments/packet.md` present. Canonical CLI `text child` from the sparse worker reads the seeded contract. |
| `Tracker.update` changes the contract while predecessor code stays fixed | Worker HEAD stays `a64618b7eb3c03f95c2eb84e6f667e785588ad69` across both rulings. Actual handler prompt contains ruling one. |
| Handler writes only an evidence artifact; global ruling two sets `drive: none` | Review successor prompt and setup contain ruling two; prompt says “Drive was skipped”, with no drive chain launch. Successor retains both predecessor-code and collector/handler-code ancestry. |
| Force materialize only `docs/issues/child.md` in an actual owning worker, commit its forbidden edit, then integrate | Refusal: `Forbidden tracker changes: docs/issues/child.md. Mutations belong through the tracker, not code branches.` Destination and source HEADs are unchanged; worker remains unarchived with its worktree present. |
| Integrate a second owning worker containing only code | `code-only.txt` reaches the destination and the worker is archived/retired. |

Refusal heads:
- Destination before/after: `f33f5b668d84c72c3f194e80f94245d6595a12a0`.
- Forbidden source before/after: `01e48573cdc7dba95f2af71d1a5a1532666c7054`.
- Successful code-only destination: `7b52aa6b47cdfa765b74b2a0f9e95bc584fc1d95`.

This activates production paths, rather than substituting the earlier backend-only
[projection](projection.md), [landing](landing-protocol.md), or
[refinement](refinement-protocol.md) helper probes. The following scheduler-mode
tickets own the longer collector/restart/refinement journeys.

## Retained protocol boundaries

Approved tests now run under `bun test lib/reconcile`:
- `scheduling.test.ts`: exact-collector release and remaining-work rollups, preserving
  canonical outside blockers, foreign claims and provisional withholding.
- `completion.test.ts`: collector landing without close, carried leaf results,
  prepared-head merge recovery, owner-only child-first close retry, and ledger replay
  after source/collector removal.
- `refinement.test.ts`: stop failure prevents cleanup; graph-safe removal and adoption
  replay preserve authority. After stubs land, both adopted and unadopted replacement
  and discard refuse until acceptance recovers; this covers saved landedHead and
  prepared-head ancestry when its landing save failed.

Existing regression intent changed deliberately: global Tracker rulings replace
branch-file contract propagation; authored tracker appends now refuse before mutation
and again after preparation. AppendUnion-only declaration assertions were deleted
because appendUnion was removed. Ordinary code-conflict abort/cleanup and landing
dependency-before-gate assertions remain.

## Required checks

At `512356a`, all required checks passed: reconcile 12/12, dispatch 6/6,
thread 15/15, tracker scripts 23/23, and TypeScript with no errors. The five
approved protocol tests are included in the reconcile count. The actual-run
sparse rehearsal passed all four reported outcomes. Its temporary target was
confirmed absent after cleanup.

```sh
bun test lib/reconcile
bun test lib/dispatch.test.ts
bun test lib/thread
bun test skills/enabled/all/mlegls/conventions/tracker/scripts
bunx tsc --noEmit
```
