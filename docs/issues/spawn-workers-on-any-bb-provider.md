---
stage: "done"
assignee: "agent:auto"
author: "session:01a1fc85-32d0-7768-9382-3e18c7628a80"
part-of: "[[projects/mlegls-pi/issues/lift-supervision-into-a-bb-plugin]]"
---
A worker can be any bb provider. Shape: [[projects/mlegls-pi/issues/lift-supervision-into-a-bb-plugin]].

- An agent's `model:` list ([routing.md](../../routing.md), [agents.ts](../../lib/agents.ts)) accepts entries naming a bb provider, e.g. `acp-antigravity/gemini-4-neon:high`, `codex/gpt-6.2-sol:high`; any other entry is a pi model, as now. [allocation.json](../../allocation.json) keys capacity by the same names (`acp-antigravity` reads quota-axi's `agy`).
- [dispatch.ts](../../lib/dispatch.ts) and [wm.ts](../../lib/wm.ts) `spawn` resolve the first usable entry at spawn time and pass its provider, model and effort to `spawnBb` ([bb.ts](../../lib/thread/bb.ts)) instead of `--provider pi`. A pi entry may still go out as `stance/<agent>` so pi workers keep in-session fallback.
- Identity (`spawnEnv`: run, handle, issue, agent, checkpoint) goes into the spawned thread's `pluginMetadata`; the supervision plugin's `experimental_contributeEnv` resolver, registered for each provider, returns it by `threadId`. `.wm/launch.env` and its sourcing in [bin/bb-pi](../../bin/bb-pi) go (bb-pi keeps the `APPEND_SYSTEM.md` part). Mind bb-pi's note about the sessionless pi bb starts beside each thread: it must not take the worker's identity.
- The reconciler handles `turn.failed` with `errorInfo.category === "rate-limit"` for a worker on a non-pi provider by replacing it with the next usable entry in its list, through its existing fresh-worker retry ([reconcile.ts](../../lib/reconcile/reconcile.ts), `retries.provider`).
- Provenance that reads `PI_SESSION_ID` (dispatch's `parent`, the ledger) reads the caller's bb thread id.

Done when: a codex worker dispatched with `model: codex/…` gets its identity env (visible in its `provider.env-resolved` event), reports through a normal turn end, and integrates; a pi worker still runs as before; a forced rate-limit on the first entry moves the replacement to the second.

## Result

done — All three stories held after the routing repair. Codex and Pi both reported `done` and integrated; the injected rate limit selected a fresh worker on the second provider. The disposable BB server was stopped and its fixture removed.

```yaml
commit: dcc1b5f3
stories:
  - story: Codex dispatch resolves worker identity, reports through normal turn end, and integrates.
    outcome: held
  - story: Pi dispatch still resolves worker identity, completes, and integrates.
    outcome: held
  - story: A typed rate limit replaces the first worker with one on the second provider choice.
    outcome: held
evidence:
  path: docs/attachments/spawn-workers-on-any-bb-provider/index.md
  visual: false
  shots: []
fixed:
  - "10ec630d: skip routes whose advertised efforts exclude the requested one; preserve explicit effort for Pi-only stances. Verified both against the live BB catalog."
  - "b43b0d43: check plugin readiness before seeding the replay and print progress before dispatch."
tests:
  - lib/dispatch.test.ts
  - lib/wm.test.ts
  - lib/wm.local.test.ts
  - lib/wm-reattach.test.ts
  - lib/thread/bb-pi.test.ts
  - lib/thread/turn.test.ts
  - lib/reconcile/launch-recovery.test.ts
  - lib/reconcile/ownership.test.ts
  - lib/reconcile/scheduling.test.ts
filed: []
caveats:
  - "Requires companion commit 25e77ab in bb-plugins; at review time it was on the spawn-workers-on-any-bb-provider branch."
  - "The live replay spent two provider turns and took 2m20s. Rate-limit verification used an injected typed BB failure and consumed no model quota."
  - "30 affected tests passed; one opt-in local test skipped. Typecheck passed."
```

Evidence: [docs/attachments/spawn-workers-on-any-bb-provider/index.md](../attachments/spawn-workers-on-any-bb-provider/index.md)
