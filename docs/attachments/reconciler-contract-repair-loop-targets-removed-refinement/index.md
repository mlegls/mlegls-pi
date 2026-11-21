# Answering a removed refinement

When a refiner reports `blocked` or `needs-input` and its attempt is removed, answer through `reconcile_resolve` with the ruling in `message`, or use `retry`. The reconciler starts a fresh writer from the previous work. If a legacy continuation left contracts carrying this run’s removed provisional claims, keep the contracts and reserve them through the tracker with `claimed-by: reconcile:<root>` before resolving. The successor’s prompt names its baseline, including the refinement root; only newly created or explicitly transferred provisional children use its new token. A late report from a removed writer goes to the owner for recovery.

## First use

From this checkout, run:

```sh
bun docs/attachments/reconciler-contract-repair-loop-targets-removed-refinement/replay.ts
```

The replay uses the actual reconciler and local tracker in a disposable Git repository (`/tmp/rc-protocol-*`), with a fake BB owner and refiner turns. It needs no account, keys, model, or running service. It seeds an agent-ready root spec and prints `ready: true` once the initial refiner has a thread and checkout. It stops the fixture reconciler and deletes the temporary target on exit.

Observed on `b54b63a8`: `root-refine-1` reported `needs-input`, its provisional child was pruned, and the owner notice said how to start a fresh writer. The fixture published a retained child under the stale token, reserved it with `reconcile:root`, then sent the owner’s `answer`. The distinct `root-refine-2` prompt carried the ruling, baseline `[root, retained]`, and its own provisional token. It inherited the committed stub. Its report listed the retained child and a new child, which used the new token. Acceptance left the original attempt removed, preserved both children, converted the new claim to `reconcile:root`, and landed the stub in the collector before the first child launch.
