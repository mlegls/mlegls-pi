# Orientation and interactive roles

- `introduce` establishes new intent in the tracker.
- `orient` answers where things stand and what to enter next. `advance` is an alias.
- `shape` drives an issue toward executable contracts, using map and plan.
- `supervise` owns an agreed subtree through implementation, verification and reconciliation. `realize` delegates to it.

Campaigns are ordinary parent issues. A scope may contain both agent-ready work and branches needing shaping. Keep its supervisor session across waves; separate shaping sessions return updated tickets and report what changed. Shared truth is in tickets/docs, working context in session/OM, and execution state in durable orchestration records.

## Preparation

Reload exec after installation (`/exec-reset`). Retain the promise:

```ts
state.preparing = orient.run(); // or orient.run("issue-subtree"), introduce.run("new intent")
notify(state.preparing.then(() => "Orientation is ready"), "orient");
```

When notified, inspect in a later cell:

```ts
const check = await poll(state.preparing);
if (check.status === "ready") {
  state.prepared = check.value;
  await show.raw(state.prepared.text);
} else await show(check);
```

If pending, end the turn and wait; if failed, inspect before retrying. Directly awaiting preparation can exceed the cell deadline and destroy the kernel.

The returned text is a read-only briefing, not permission to execute a recommendation. Orient reports progress, known supervisors, ready unowned work and a leverage-ranked human queue. Introduce uses its briefing to establish and record the idea. Neither silently becomes a local implementation session.

Outside exec, import run from lib/orient.ts, lib/advance.ts or lib/introduce.ts and pass `{ reader: { sessionFile, cwd } }`. The session file is explicit.

## Mechanism

lib/prepare.ts calls autoread once under [workflows.md](../workflows.md), then checks that the response contains orientation rather than an acknowledgment or wait message. A rejected response retains the reader and its transcript reference. Empty, blocked, missing and unreadable scopes are valid explained results. This check is not a correctness proof.

The briefing is returned intact with its reading and judgment in `audit`. There is no candidate-session selection or model-routed reassignment of the interactive role. Options are `reader` (autoread options except submission) and `policyPath`. [workflows.json](../workflows.json) supplies the reader default; [routing.md](../routing.md) governs delegated assignments. Autoread remains useful inside shaping and supervision for bounded orientation.

## Verification

An orient call over a specified ticket should locate it within the scope and recommend an entry, not command its implementation. A workflow discussion should remain a discussion even when related executable tickets exist. An introduce call should locate and establish intent rather than start executing it. Preparation leaves tracker and source session unchanged.

The older selection pipeline's observations are retained in [2026-09-20 verification](research/session-preparation-2026-09-20.md); they are not verification of the current orientation-only policy.
