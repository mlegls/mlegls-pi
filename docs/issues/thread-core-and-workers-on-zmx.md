---
stage: ticket
assignee: agent:technical
author: session:01a0f69a-dbcb-7684-87de-422739d2c54e
part-of: "[[projects/mlegls-pi/issues/thread-registry-on-zmx]]"
blocked-by: ["[[projects/mlegls-pi/issues/thread-merge-command-lifetime]]"]
priority: 2
---

Session mode: hacking. Build `lib/thread/` and the `ab thread` CLI from [[projects/mlegls-pi/issues/thread-registry-on-zmx]] (its decisions and interface are the contract), and move workers onto it. Preserve [[projects/mlegls-pi/stories/work-in-threads]].

The implementation is partitioned into ticket children. The committed `lib/thread/index.ts` exports the shared types and throwing stubs; no consumer has switched yet. [Transport/SDK evidence](../attachments/thread-core-and-workers-on-zmx/source-contract.md) records the known-id session persistence, zmx wire grammar and pi restart constraints.

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

## Open decision

[[projects/mlegls-pi/issues/thread-merge-command-lifetime]] asks only what the separate user-facing merge command does to active threads. Archive/abandon and raw integrate-with-keep are specified; the CLI and this join cannot invent merge's lifetime. The other children are closed and may proceed.
