# Pi startup-argument dispatch — 2026-09-21

Replaces the editor-injection path described in [the start-gate investigation](orca-start-gate-2026-09-21.md). Driven through the direct API in [Orca execution and coordination](../orca.md); this repository has no corresponding story file.

## Protocol

Create or reuse a Task. Create a caller-owned terminal running a bounded shell bootstrap. Native `dispatch --return-preamble`, without `--inject`, enrolls that terminal and returns the full lifecycle preamble plus Task. Atomically publish that text and the launch correlation marker to a mode-0600 prompt file in a private temporary directory. The bootstrap executes Pi with model/effort flags and an `@prompt.md` argument. Retain the existing correlated turn-start confirmation and error receipt; remove the extension-startup and native TUI-idle gates.

The installed CLI returns contract-version-1 dispatch context on this path, without a capability token. The returned preamble is used unchanged; no capability is invented or reconstructed. Native dispatch owns Task/Dispatch/mail identity, not process supervision. Worker release reports `no_owned_resource`, so settled terminal cleanup remains caller-owned.

## Drives

- Contract discovery: task_46eed0bb23e6 / ctx_d992b55ec035 enrolled a shell terminal without injecting input. The preamble included its Task. Diagnostic terminal closed; native attempt failed.
- Fresh-spec submit: task_57d3adec08c7 / ctx_0ba8e497a622 reached `turn_started`. The initial persisted user message contained the preamble, assignment, and literal Unicode/quote/dollar/command-substitution sentinel. The selected OpenAI provider then reported no credits; this is not a delivery failure. Terminal closed after the failed assistant turn; native attempt failed.
- Existing-Task start: task_b38db56d8c54 / ctx_14c67023f4f5 started DeepSeek with approximately 10 KB of Unicode and shell metacharacters. The first persisted user message contained the published prompt byte-for-byte. Its worker_done was accepted, release reported no owned resource, the exact terminal was closed, and delivery_f39a69e56bc3 was acknowledged.
- No-start: task_eb63972ee8de / ctx_e104a2a0c4ab deliberately used `false` as the startup command. Publication succeeded but no Pi turn began. Submit threw with `stage: prompt_published`, unconfirmed evidence, and Task/Dispatch/terminal IDs intact. No assignment was replayed. Diagnostic terminal closed; native attempt failed.
- Existing suite: 201 passed, 1 skipped, 0 failed. `git diff --check` passed. Typecheck and Jev lint remain blocked by the missing `typescript` dependency in `lib/lint/extract.ts` (plus its three consequent implicit-any errors).
- Scoped scc against d12c8ca: code 424 → 442 (+18), complexity 150 → 147 (-3). Scope: lib/orca.ts, extensions/orca/index.ts, extensions/exec/modules.ts.

## Limits and cost

This is a local POSIX/shared-filesystem protocol, not a remote launcher. No full routed worktree wave was driven; existing wave tests passed. Startup files remain private and retained for recovery. Separate Task creation and dispatch add receipt plumbing; accepted until native worker-start can accept Pi arguments while owning the process. Native injection loss itself remains unexplained, but Pi launches no longer use that path.
