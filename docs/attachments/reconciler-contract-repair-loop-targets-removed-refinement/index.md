# Answering a removed refinement

When a refiner reports `blocked` or `needs-input` and its attempt is removed, answer through `reconcile_resolve` with the ruling in `message`, or use `retry`. The reconciler starts a fresh writer from the previous work. If a legacy continuation left contracts carrying this run’s removed provisional claims, keep the contracts and reserve them through the tracker with `claimed-by: reconcile:<root>` before resolving. The successor’s prompt names its baseline, including the refinement root; only newly created or explicitly transferred provisional children use its new token. A late report from a removed writer goes to the owner for recovery.

## First use

From this checkout, run:

```sh
bun docs/attachments/reconciler-contract-repair-loop-targets-removed-refinement/replay.ts
```

The replay uses the actual reconciler and local tracker in a disposable Git repository (`/tmp/rc-protocol-*`), with a fake BB owner and refiner turns. It needs no account, keys, model, or running service. It seeds an agent-ready root spec and prints `ready: true` once the initial refiner has a thread and checkout. It stops the fixture reconciler and deletes the temporary target on exit.

Observed on `b54b63a8`: `root-refine-1` reported `needs-input`, its provisional child was pruned, and the owner notice said how to start a fresh writer. The fixture published a retained child under the stale token, reserved it with `reconcile:root`, then sent the owner’s `answer`. The distinct `root-refine-2` prompt carried the ruling, baseline `[root, retained]`, and its own provisional token. It inherited the committed stub. Its report listed the retained child and a new child, which used the new token. Acceptance left the original attempt removed, preserved both children, converted the new claim to `reconcile:root`, and landed the stub in the collector before the first child launch.

## Independent drive (`8b760fe6`)

## Predictions before launch

1. When a writer reports a blocker or asks for input, its attempt is removed. A late done from that writer cannot revive it, and the owner sees how to continue rather than another request for contract repair.
2. An owner answer starts a fresh writer. Retained children and committed stubs survive, and the successor is told to use stable run claims on retained contracts (including the root) and its provisional token only on new children.
3. A fresh writer can complete the partition and hand execution back to the run without further contract edits solely to regain writer ownership.

## Encounter

Ran the command above. The disposable checkout printed `ready: true` with `root-refine-1`; the run finished successfully in 34 seconds and the temporary checkout was gone afterward.

1. **Owner guidance — met.** After `needs-input` (“Should live setup be outside this run?”), the owner notice said the attempt was removed, reposting could not work, and `answer` or `retry` starts a fresh writer. It gave the exact stable claim (`reconcile:root`) for reserving retained contracts. A separate late `done` was not visible in this recording.
2. **Fresh writer and preservation — met on the answer path.** The replay showed `root-refine-1` → `root-refine-2`, baseline `[root, retained]`, and the same stub commit as the original report. The owner notice gave the stable claim; the output did not expose the successor prompt verbatim, so its exact instructions were not independently observed. `retry` was advertised but not exercised separately.
3. **Acceptance — met.** The replay reported `root-refine-2` accepted with `[retained, fresh]`, stable claim `reconcile:root`, and `stubsLanded: true`. It did not print a downstream worker launch.

### Friction

The focused recovery paragraph gave a clear next step. The generic list of resolution actions immediately below it included unrelated options; I could still tell which actions applied. The replay is a compact summary, so it cannot establish the wording of the successor prompt or a separately submitted late report from its printed output.

### Replay checks

- Run the command above; expect readiness on the first writer, then an owner notice naming that removed writer, `answer`/`retry`, and `reconcile:root`, without asking the writer to repair contracts.
- On owner answer, expect a different writer with the root and retained child in baseline and the original stub commit. On acceptance expect both children and `stubsLanded: true`.
- For the unobserved edges in a disposable run, submit a late `done` from the removed writer and look for owner recovery instead of acceptance or contract-repair mail. Open the successor's first prompt and check that retained baseline contracts use the stable run claim while newly created children use the successor token.
