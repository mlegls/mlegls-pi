---
stage: ticket
assignee: agent:technical
author: session:01a0f69a-dbcb-7684-87de-422739d2c54e
part-of: "[[projects/mlegls-pi/issues/thread-registry-on-zmx]]"
priority: 2
---

Session mode: hacking. Build `lib/thread/` and the `ab thread` CLI from [[projects/mlegls-pi/issues/thread-registry-on-zmx]] (its decisions and interface are the contract), and move workers onto it. Preserve [[projects/mlegls-pi/stories/work-in-threads]].

The four ticket children are implemented, driven, reviewed and integrated. `lib/thread/index.ts` exports the registry/runtime/lifecycle API; workers and consumers use it. [Transport/SDK evidence](../attachments/thread-core-and-workers-on-zmx/source-contract.md) records known-id session persistence, zmx wire grammar and pi restart constraints. The remaining stage is the residual join and independent verification below.

- [[projects/mlegls-pi/issues/thread-registry-and-zmx-launch]] owns registry/runtime and mise dependency/setup.
- [[projects/mlegls-pi/issues/thread-archive-and-abandon]] owns git integration and recursive lifecycle.
- [[projects/mlegls-pi/issues/thread-cli-over-registry]] owns CLI routing.
- [[projects/mlegls-pi/issues/wm-workers-over-threads]] owns the atomic worker cutover: Worker, /jump, session-meta/report joins, dispatch/integrate/retire, children and reconciler consumers.

## First-use setup

Use this checkout's `bin/ab`, not the globally installed ab script. For fresh pi/tool driving, isolate `PI_CODING_AGENT_DIR` in temporary scratch, register this checkout's absolute package path in its `settings.json` `packages` list, and reuse the existing pi persona/auth through an uncommitted local auth link or provider environment. Start pi from the changed checkout with that agent dir; worker spawn carries it onward. Do not point the fixture at canonical main or assume `/reload` changes an already-loaded package's source path. Keep secrets out of handoffs/evidence, provide the prepared agent-dir path and launch command, and remove the scratch auth link afterward. Pi flags/package configuration are documented in the active installation's `docs/cli.md` and `docs/packages.md`.

## Residual join

Once children land, finish only seam repairs and drive the original first-use journeys; do not rebuild their internals.

1. From a pi loaded from this checkout, `tools.dispatch` a trivial worker on this branch. Observe its run/handle board report, `integrate` it into its recorded ab-parent (this dispatcher's branch), and compare pre/post `zmx ls`, `ab thread ls --json`, git worktree/branch inventories. There must be no resources belonging to that worker left; don't delete unrelated active threads or the worker running this join.
2. In a disposable owned git project, archive a two-level thread tree with a deliberate child conflict. Observe child-directed conflict messaging, fresh child done and post-order resumption/cleanup; also observe the blocked-child path retaining that child/ancestors with its marker.
3. Check new/fork/promote, literal send/history, current-session identity and thread/report joins across the CLI/worker cutover. Confirm the reconciler's nested workers store the actual integration checkout's branch as ab-parent even when their base is a collector SHA.
4. Supply the checkout/fixture state, ids, runnable commands and pi reload/entrypoint to the independent driver. Record nonvisual evidence under `docs/attachments/thread-core-and-workers-on-zmx/` following `docs/verification-evidence.md`. The sidebar sibling writes the full user-facing work-in-threads guide; this join records CLI/worker evidence, not its unimplemented UI.

No new worker/thread path uses workmux/tmux. Workmux code/resources stay until [[projects/mlegls-pi/issues/delete-workmux-and-tmux-paths]]; pre-cutover reconcilers drain on their old code. There is no new dual-backend migration/adoption path.

## Merge alias

[[projects/mlegls-pi/issues/thread-merge-command-lifetime]] is answered: `ab thread merge` aliases archive, including post-order retirement, guest handling and conflict blocked/resume behavior. `/thread merge` and frontend merge actions share it; `integrate(keep: true)` remains non-retiring. The CLI child and join have no remaining external decision blocker. Drive the merge alias as well as archive, without adding a distinct lifecycle path.

## Result

The fresh-tool round-trip and two-level archive/merge joins held. No production repair was needed. The existing worker fixture now has `join ROOT`, starting a fresh pi loaded from this checkout and dispatching/integrating a trivial worker on its current branch. [Core join packet and runnable setup](../attachments/thread-core-and-workers-on-zmx/index.md) records actual tools calls, board identities, CLI conflict/blocked/resume, current-session/transport joins, nested collector lineage and cleanup. This is implementation first use; independent driving/review remains.

[Independent core drive](../attachments/thread-core-and-workers-on-zmx/independent-drive.md) reached the fresh tools and CLI/worker surfaces without reading implementation. Joins held after committing the driver's initial dirty prediction log. Nested branch lineage held; the committed fixture output did not expose dispatch base SHAs, so independent verification of that premise remains reviewer-owned. All owned fixture resources were removed.

### Evidence

Before: the child packets exercised their own surfaces; the fresh-tool/CLI joins after the atomic cutover were still outstanding. After: the required joins held on inherited production code; 182 regressions passed, 2 skipped, typecheck and opt-in worker regression passed. The packet records the existing setup and historical-link tooling owners.

### Danger

Door: two-way for this join's fixture/docs changes. Running `join` integrates an empty commit into its owned checkout; archive/merge remains a retiring lifecycle, so conflict fixtures must be disposable.
Blast radius: fixture. No production API or transport changed.
