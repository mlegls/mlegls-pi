# Run supervision from BB

Supervise from a Pi thread in the project's checkout on the BB server. Pi reaches BB's supervision tools through codemode, and the Pi extension filters completion notices for owned workers. Workers themselves can run on Pi, Codex, Claude Code, or an installed ACP provider.

## Server setup

1. In `~/dev/bb-plugins/supervision/`, build and install (or reload) the plugin: `npm ci && bb plugin build .`, then `bb plugin install --yes .` or `bb plugin reload supervision`.
2. Verify `bb plugin config supervision`: `checkout` should point to this `mlegls-pi` checkout on the server (default `~/dev/mlegls-pi`), and `bun` should be an absolute path if the login shell can't resolve it.
3. Confirm `bb plugin list` shows `supervision` running. `bb plugin rpc call supervision workerSpawn --json` with no input should return `invalid_input` (confirming the RPC schema is loaded).

## Start a run

In the Pi supervisor thread, check `reconcile_status` on the issue, then start `reconcile`:

```js
text(await tools.reconcile({ issue: "hello-tracer", budget: 1, land: "local" }))
```

- `reconcile_status` shows worker phases and owner exceptions; `reconcile_stop` stops a run and retires its workers.
- For standalone assignments, `dispatch` attaches workers to the calling thread; finish with `integrate` (which replays commit hooks) or `retire`.
- `pickup`, `pickup_status`, and `pickup_stop` run and manage the watcher that starts reconcilers automatically for ready issues in scope.

An exact assignment names the BB provider and model (e.g. `codex/gpt-6.2-sol:high` in an issue, or `{ model: "codex/gpt-6.2-sol", effort: "high" }` in `dispatch`). A mixed stance list picks the first route with delegated capacity and falls back down the list on a typed rate-limit. See [routing.md](../../routing.md).

To try an `acp-antigravity` worker end-to-end without touching live routing, see [antigravity-workers-in-reconcile](../attachments/antigravity-workers-in-reconcile/index.md).
