---
stage: "ticket"
assignee: "agent:auto"
author: "session:01a1fc85-32d0-7768-9382-3e18c7628a80"
part-of: "[[projects/mlegls-pi/issues/lift-supervision-into-a-bb-plugin]]"
blocked-by:
  - "[[projects/mlegls-pi/issues/supervision-tools-as-bb-native-tools]]"
---
A worker can be any bb provider. Shape: [[projects/mlegls-pi/issues/lift-supervision-into-a-bb-plugin]].

- An agent's `model:` list ([routing.md](../../routing.md), [agents.ts](../../lib/agents.ts)) accepts entries naming a bb provider, e.g. `acp-antigravity/gemini-4-neon:high`, `codex/gpt-6.2-sol:high`; any other entry is a pi model, as now. [allocation.json](../../allocation.json) keys capacity by the same names (`acp-antigravity` reads quota-axi's `agy`).
- [dispatch.ts](../../lib/dispatch.ts) and [wm.ts](../../lib/wm.ts) `spawn` resolve the first usable entry at spawn time and pass its provider, model and effort to `spawnBb` ([bb.ts](../../lib/thread/bb.ts)) instead of `--provider pi`. A pi entry may still go out as `stance/<agent>` so pi workers keep in-session fallback.
- Identity (`spawnEnv`: run, handle, issue, agent, checkpoint) goes into the spawned thread's `pluginMetadata`; the supervision plugin's `experimental_contributeEnv` resolver, registered for each provider, returns it by `threadId`. `.wm/launch.env` and its sourcing in [bin/bb-pi](../../bin/bb-pi) go (bb-pi keeps the `APPEND_SYSTEM.md` part). Mind bb-pi's note about the sessionless pi bb starts beside each thread: it must not take the worker's identity.
- The reconciler handles `turn.failed` with `errorInfo.category === "rate-limit"` for a worker on a non-pi provider by replacing it with the next usable entry in its list, through its existing fresh-worker retry ([reconcile.ts](../../lib/reconcile/reconcile.ts), `retries.provider`).
- Provenance that reads `PI_SESSION_ID` (dispatch's `parent`, the ledger) reads the caller's bb thread id.

Done when: a codex worker dispatched with `model: codex/…` gets its identity env (visible in its `provider.env-resolved` event), reports through a normal turn end, and integrates; a pi worker still runs as before; a forced rate-limit on the first entry moves the replacement to the second.
