# Completed worker handoff

## Prediction before first use

As reconciler operator, launch a fresh local fixture as its fake implement worker (anonymous, disposable checkout). Expect `Ready` with the solo ticket in implement. Submit a first-line `done` using `--compact-after`. Expect the completed implement turn to advance to drive even after the output projection is cleared, without an empty-report nudge or status escalation.

## Setup and replay

Tested `c188c3e6` from the drive worktree. `new` finished successfully, printed `Ready`, and identified its fresh caller-owned target as `/tmp/rc-setup-z0xBQ5`. The initial snapshot showed the fake `solo-implement-1` worker with no exceptions. This was an offline CLI fixture, with no authentication or shared deployment.

```sh
bun lib/reconcile/setup-fixture.ts new
# Set ROOT to the retained target printed by new.
BODY=$(printf '%s\n' 'done' '' '```yaml' 'setup: {entry: bun app.ts}' '```')
bun lib/reconcile/setup-fixture.ts turn "$ROOT" "$BODY" --compact-after
bun lib/reconcile/setup-fixture.ts status "$ROOT"
bun lib/reconcile/setup-fixture.ts stop "$ROOT"
```

## Outcome and replay check

**Held.** The submission snapshot still showed implement; the subsequent `status` showed `phase: drive`, a launch log entry for `solo-drive-2`, and `entry: bun app.ts` in that worker's setup handoff. The implement worker's tells were empty and the reconciler reported `exceptions: {}` with no status retry. Both predictions were met. Cleanup exited successfully.

When replaying, judge the settled `status`, not the immediate submission snapshot. Require drive phase, the original setup entry in the new prompt, no implement-worker repair tell, and no status exception. The asynchronous snapshot is the only point that could be mistaken for a failure; existing fixture documentation describes the delay. This replay exercises the compacted-output case in the offline fixture, not live BB compaction timing.
