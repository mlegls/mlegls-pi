# Moved-out work keeps its original tree

Implementation first use at 2eb3fc87f6f1d2d7bdf4db2d421007a4537b093e. Nonvisual; local Git/vault tracker, fake bb, no model calls or credentials. Independent driving and acceptance follow this implementation handoff.

Independent CLI drive at d738d81a45b36409dac3436c0232dc6b5461cc7b: [predictions, encounter and replayable checks](drive.md). Both required claims held in a fresh isolated sandbox.

## Reproduce the starting surface

From the checkout, start this as a managed process:

```sh
bun docs/attachments/moved-out-node-loses-its-parent-and-pickup-runs-it-as-a-root/setup.ts
```

[setup.ts](setup.ts) uses the existing [protocol fixture](../../../lib/reconcile/protocol-fixture.ts). It prints its unique sandbox checkout, tracker and reconciler CLI paths, owner and stop-file path. The sandbox owns its Git repository, collector, tracker, agent roster and fake bb state. The seed is a root spec with a parented goal child, an implementation chain held on an owner exception, and a reservation for the original run. The process runs that reconciler in the foreground.

Use the printed paths as CWD, TRACKER and RECONCILER:

```sh
bun "$RECONCILER" resolve root child '{"action":"move-out","summary":"Authentication shaping"}' --cwd "$CWD"
(cd "$CWD" && bun "$TRACKER" fields child --json)
(cd "$CWD" && bun "$TRACKER" check)
(cd "$CWD" && bun "$TRACKER" update child --fields '{"assignee":"agent:shell"}')
bun "$RECONCILER" status --cwd "$CWD"
(cd "$CWD" && bun "$TRACKER" update child --fields '{"stage":"ticket"}')
bun "$RECONCILER" status --cwd "$CWD"
```

The same run should remain parked through the agent-assigned goal, then launch child-implement-1 into root's collector when it becomes a ticket. The fake bb worker stays active without running a model.

For cleanup, create the printed stop-file path with the write tool. The process aborts and removes its sandbox; it also cleans up after ten minutes. Wait for process completion before finishing.

## Observed

The committed setup was opened and driven through the public resolve, tracker and status/library surfaces in sandbox rc-protocol-G6iUNS:

- Resolving move-out changed the child to human, kept part-of root and stage goal, and released claimed-by. Tracker check returned ok.
- Reassigning the goal to agent:shell left finished null, moved.child present and chains empty.
- Promoting it to ticket logged moved back in: child, then launched child-implement-1. Its receipt named run root, into root, phase implement, and moved was empty.
- A temporary first-use experiment also changed the parked child to idea: its parent survived and no human worker launched. Reassignment to an agent ticket produced exactly one fake bb spawn in the original collector.
- The same experiment passed a detached frontier child with a recorded moved reservation to pickup.select. Selection returned no starts and the reason “moved out of reconciler root; resume its original tree”.
- Both temporary experiments and the interactive setup exited successfully; their sandboxes were removed. No dev server or real bb thread was started.

The historical Concept tracker was untouched. Legacy moved records contain a reason, not the old parent: pickup now reserves those nodes, while repairing an already-detached node still needs its known parent restored and the original stopped run restarted.

## Existing checks

```sh
bun test lib/tracker.test.ts lib/reconcile/pickup.test.ts lib/reconcile/exceptions.test.ts lib/reconcile/scheduling.test.ts lib/reconcile/refinement.test.ts skills/enabled/all/mlegls/conventions/tracker/scripts/issues.test.ts
bun test lib/reconcile/pickup.test.ts lib/reconcile/exceptions.test.ts lib/tracker-github.test.ts
bun run typecheck
```

The first selection passed 49 tests, 870 expectations. After the final readiness and idea-retention edits, the second selection passed 19 tests, 110 expectations; typecheck passed. No permanent acceptance tests were added.
