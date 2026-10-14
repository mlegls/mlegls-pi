# Durable PR lifecycle first use

Implementation: `e637fff6`, immediate-publication merge correction: `2d2a2b7a`.
Existing refinement fixture bound repair: `dfdb972b` (no assertions changed).
Base: `009ca3d2f0151291839c5c0ea3e0958a3c583b35`.

## Setup and entry

Required and prepared: invocation-owned scratch bare Git remote, real run-owned
staging receipt, isolated board/registry/state and shell workers, injected typed
host. This is **not live GitHub**. PR identity, check results and terminal states
are seeded; Git fetch/merge/push, dependency/gate calls, worker dispatch,
integration, retirement and vault tracker closure execute normally. No auth or
secrets are needed. Native GitHub issue identities are separately seeded for the
body capability probe, not extracted from slugs.

From the worker/package checkout, run:

```sh
bun docs/attachments/reconcile-pr-checks-and-branch-updates/probe.ts
bun docs/attachments/reconcile-pr-checks-and-branch-updates/probe.ts publication-zero
```

Each invocation generates its own `/tmp/rc-pr-lifecycle-*` repository, bare
remote, owner, contributor, staging checkout, shell launcher and declared mise
gates. It clears inherited deployment/runtime selectors and uses only those
owned targets. The entry opens the story surface itself: it starts a real root
run and finishes implement → drive → review through deterministic shell reports,
then drives `advancePullRequest` from the saved staging receipt. Shell readiness
is observed through `shell-started`; the declared gate is actually run. The
normal mode proceeds only after root cleanup and the publication-cut owner
exception are observed. Normal and failure cleanup retire registered fixture
workers and remove the invocation-owned directory. No resident service is
required or retained.

## Independent drive

[Fresh-user predictions, replay and observations](drive.md) on `715ec08d87ea3a284650ab2957685b5868355acf`: both supplied modes exited 0 with owned resources retired. No implementation, probe internals or tests were read by the driver.

## Encounters

| Claim | Action and observation |
|---|---|
| One PR after publication interruption | Create seeded PR 17, then throw before saving its identity. Saved phase was opening, number absent, root staged and globally ticket. Recovery looked up the same PR; create count remained one. Repository template, summary/Evidence/Danger and original per-node reviewed outcomes were retained. |
| Native closing references | Seed opaque root/child/unfinished-parent identities 41/72/90. Body contained `Closes #41`, `Closes #72`, `Part of #90`; cross-repository identity was refused. Vault body had no closing lines. |
| Remote waiting has no idle worker | All three real root workers were retired before the PR wait. A tick inside the saved poll interval made no remote observation. Pending fetched-base checks ran no gate and launched no worker. |
| Errors are not empty checks/closure | Seed API unavailability: owner exception with PR URL/head; root stayed globally ticket. No merge or close was inferred. |
| Failed head check and gate repair | Seed build failure with exact head and diagnostic URL/text. Launch one real review-role shell worker, repair `ci.txt`. A deliberately failing declared gate refused integration, consumed one integration failure and sent a merge-only re-drive request to that same worker. Fix the gate and repost held stories/evidence. |
| Exact launch and prepared ancestry recovery | Cut the worker-handle save after actual dispatch. Reload the saved request/launch handle and reattach the same registry identity: one live launch. Cut the integrated-head save after real integration; reload the prepared worker OID and prove it is already in staging rather than merging the repair twice. |
| Contributor race preserves history | A real pre-push hook pushes an independently committed contributor branch between the last fetch and local push. The resulting non-fast-forward refusal keeps the worker/receipt. Refresh, merge the foreign history, rerun gates, push normally, then retire the worker. Both contributor and repair commits remain ancestors. Hooks remain enabled. |
| Base advancement and conflict | Push a new base commit; staging merges it, gates and pushes. Publish a branch edit to `conflict.txt`, then push a divergent base edit. Repair request named the file and both histories. A second real worker resolves the merge and is gated/integrated/pushed/retired. Both base histories and contributor commit survive. |
| Shared bounded repairs | Two repair launches total (CI and base conflict). Another seeded head failure raised a budget-exhausted owner exception with diagnostics, launching no third worker. Original reviewed node results were unchanged; repair evidence lives in additional PR receipts/history. |
| Human-review mode never merges | All publication, CI repair, contributor/base updates and conflict repair above ran in pr-review. Merge call count stayed zero, including passing checks. Submitted-review selection remains the sibling ticket's dormant seam. |
| Closed unmerged | Observe CLOSED: phase closed, owner exception, root still globally ticket, original PR/create count retained. Reopen that same seeded identity to continue. |
| Guarded auto merge and unavailable owner | Switch the saved run to the probe's pr-merge encounter. Pending head checks made no merge call; genuinely empty checks caused one head-guarded merge-commit request. Root remained ticket after the request. With owner unavailable and ownerHeld, observe MERGED, fetch/prove ancestry, then close at `github:seeded/lifecycle:main`; ownerSync was left. |
| Newly published zero-check PR | The `publication-zero` invocation runs the real scheduler in pr-merge. Create once, freshly observe/check exact head/base, request one guarded merge without a minute-long grace period, observe proven MERGED and close. Clean owner fast-forwarded; all workers retired. |
| Gates before pushes | The normal invocation checks every staging push-hook OID against the real gate log. Final normal encounter ran 11 gates and 4 merge hooks. No history rewrite or force push is used. |

## Selected identities and regression checks

Final normal replay (106s, exit 0) used one seeded PR identity, number 17:

- Reviewed root staging head: `27de8b1401c81493791572b13f1722894494b7aa`.
- Recovered prepared worker: `074be26735be0d56f8d46fc4da763ea4c8c3adc8`.
- Preserved contributor: `befdb1ec35707c5bbe7f5afe0fb72e6c904ee68f`.
- Preserved clean base update: `f76574f904b849c0b9e007f5578fbc639a7364cc`.
- Preserved conflicting base: `299b52b5fc57f59427405a78e6e166d6b4ec17b2`.
- Final gated/pushed staging head: `73d782743353ffbec417530e173a7fb5f7c8f04b`.
- Observed/fetched merge: `5653509894df7c97395ae0dbfa8fcf5014e3d290`.

The probe asserted the recorded root, worker and external histories through
staging/merge ancestry, and matched each staging push OID to a preceding gate
run. PR wait and terminal cleanup had zero non-archived root workers.

The zero-publication replay (64s, exit 0) used prepared/pushed head
`d5f9cd914158410f4b70d7788fb1ed51121083d9`, observed merge
`8a3c53b4821ee121cf58c69247be3b6677c19d5f`, one create and one guarded merge;
the clean owner was updated.

These are private disposable Git identities, not accessible GitHub URLs. All
invocation-owned resources were retired.

Regression commands:

```sh
bun test lib/reconcile skills/enabled/all/mlegls/conventions/tracker/scripts
bunx tsc --noEmit
```

The first combined run passed 37 tests (839 assertions). Under later shared-host
load, the existing refinement recovery case repeatedly exceeded its 30-second
bound, including an isolated retry. The same case with a 120-second bound passed
all 34 existing assertions in 36,683.80ms. `dfdb972b` changes that fixture bound
only; it adds no test and weakens no recovery assertion. Evidence was added to
[the existing friction issue](../../issues/reconciler-refinement-regression-exceeds-thirty-second-timeout.md)
through the global tracker; the repair is pending this branch's integration.
Final combined rerun on `dfdb972b` plus the committed-probe preparation changes:
**37 passed, 0 failed, 839 assertions** (193.60s). The chained
`bunx tsc --noEmit` also passed; the combined process exited 0. No new retained
tests were added.

## Boundaries

Live GitHub CI, authenticated review/reply replay and the two-ticket journey
belong to the later rehearsal. This ticket implements the dormant review repair
executor (required per-thread replies, marker receipts, processed/repaired IDs),
but deliberately does not fill or pretend to exercise submitted-review selection.
The packet is nonvisual library/CLI evidence; no screenshots are applicable.
