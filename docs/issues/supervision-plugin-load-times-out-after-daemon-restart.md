---
stage: "done"
assignee: "agent:auto-routine"
priority: 1
author: "session:01a1cdb0-4d22-72bc-8778-94e6b358a046"
---
After each bb host daemon restart on 2026-11-21 (two in a row), the `supervision` plugin came up as `error (load timed out after 30000ms)`. `bb plugin reload supervision` then loaded it in under 5 s both times. Until someone reloads it, every reconciler launch fails with `plugin "supervision" has no rpc method "workerSpawn"`, and fresh threads have no supervision tools. Nothing announces the failure.

The plugin's default export in [server.ts](../../../bb-plugins/supervision/server.ts) awaits `registerWorkers(bb)` before anything else, and that awaits `bb.sdk.providers.list()` ([workers.ts](../../../bb-plugins/supervision/workers.ts)). During daemon startup that SDK call probably waits on the providers, which are still starting or waiting on plugin load, so it doesn't return within the load deadline. Host load average was ~44 at the time. Not yet confirmed. The first thing to establish is which await stalls.

Likely shape: register tools and the RPC synchronously, and contribute per-provider worker routes once `providers.list()` resolves (or on a provider-change event, if the SDK has one), so load never waits on other subsystems.

## Done when

- After `bb` host daemon restart, `bb plugin list` shows supervision `running` without a manual reload, and `bb plugin rpc call supervision workerSpawn --json` returns `invalid_input`.
- Workers still spawn on every provider that existed before the change.


## Result

done — Both restart and worker-spawn stories held on the reviewed plugin. **Landing requires two repositories:** this branch carries the evidence; the runtime fix is `bb-plugins` commit `c9c60ff` on `supervision-restart-load`, still outside `bb-plugins/main`.

```yaml
commit: 59937242
stories:
  - story: Supervision loads and registers workerSpawn after daemon restart without a manual reload.
    outcome: held
  - story: Workers still spawn on every previously installed provider.
    outcome: held
evidence:
  path: docs/attachments/supervision-plugin-load-times-out-after-daemon-restart/index.md
  visual: false
  shots: []
fixed:
  - Clarified the replay's readiness and shutdown checks after the driver observed an empty host list and a stop taking longer than three seconds.
tests: []
filed: []
caveats:
  - The companion plugin passed its TypeScript check. The driver observed a thread ID on all five providers; first replies were outside the spawn check.
  - Restart verification used an isolated BB 0.50.1 daemon. The shared daemon was untouched.
```

Evidence: [docs/attachments/supervision-plugin-load-times-out-after-daemon-restart/index.md](../attachments/supervision-plugin-load-times-out-after-daemon-restart/index.md)
