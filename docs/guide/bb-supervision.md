# Run supervision from BB

Supervise from a Pi thread in the project's checkout on the BB server. Pi reaches BB's native tools through codemode. Workers can run on Pi, Codex, Claude Code or an installed ACP provider. The supervisor stays on Pi so the extension can filter owned worker completion notices.

## Upgrade the two checkouts together

1. Let active reconciles finish and stop pickup before replacing the backend. Update `mlegls-pi` and the Pi package BB loads before starting fresh Pi provider sessions. This version gets its supervision tools from BB; a Pi package that still loads `extensions/supervision` registers the same names and can fail to start.
2. On the BB server, update `~/dev/bb-plugins` to a revision with the supervision worker RPCs (`25e77ab` or a successor). From its `supervision/` directory run `npm ci` and `bb plugin build .`. For a new path install, run `bb plugin install --yes .`. On an existing path install, reload with `bb plugin reload supervision`.
3. Check `bb plugin config supervision`. The `checkout` setting must point to the updated `mlegls-pi` code on that server (default `~/dev/mlegls-pi`); set `bun` to an absolute path if the login shell cannot find it. Enable supervision and open a fresh Pi thread. `bb plugin list` should show supervision running.

The backend and worker checkout are local to the BB server. From that server's shell, `bb plugin rpc call supervision workerSpawn --json` with no input should return `invalid_input`: schema validation found the new RPC without launching a worker. A missing RPC means the plugin source or loaded build is still old, even if the native tools are listed.

## Start a run

From the Pi supervisor thread, ask for `reconcile_status` on the intended issue, then `reconcile` when it is ready. For example, through codemode:

```js
text(await tools.reconcile({ issue: "hello-tracer", budget: 1, land: "local" }))
```

Use `reconcile_status` to follow the worker phases and owner exceptions. `reconcile_stop` stops a run and retires its workers. For individual assignments, `dispatch` attaches workers to the calling thread; finish them with `integrate` or `retire`. Integration replays the repository's commit hooks before landing incoming commits. If ready issues should start automatically, `pickup` starts the repository watcher; use `pickup_status` and `pickup_stop` to inspect and stop it.

An exact assignment names the BB provider and model, e.g. `codex/gpt-6.2-sol:high` in a tracker issue or `model: "codex/gpt-6.2-sol", effort: "high"` in a dispatch assignment. A mixed stance list selects the first available route with delegated capacity. On a typed rate-limit, the reconciler can replace a native worker using a later entry in that list. See [routing](../../routing.md).

To try Antigravity without changing live routing or working on a real issue, follow the [disposable native-tool tracer](../attachments/antigravity-workers-in-reconcile/index.md). It starts in Pi codemode and lands a greeting after implement on `acp-antigravity`, drive and review. The worker uses the host's existing `agy` login.
