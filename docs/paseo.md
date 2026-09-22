# Paseo bounded trial

This branch ports the old BB pattern: native host substitution plus a thin prepared-assignment launcher. It does not port the Orca Run/Task/Dispatch abstraction. The parent owns decomposition, dependencies, capacity and acceptance. There is no scheduler, automatic retry, enrollment or inbox acknowledgment layer.

Implementation baseline: `05ef261674a4e45f2c3d0cb4fa141f452fc46942`, fast-forwarded from the stale checkout before edits. Historical references: `ff22e65` (host-local wm/board replacement), `88ce495` (thin dispatch), `fc8a27e` (visible BB reader), `90f2af3` (BB removal). Later routing, tracker ownership, continuation, integration, supervision and verification policy remain.

## Host behavior

- `PASEO_AGENT_ID`: native Paseo workspaces, agents and messaging, even when Orca variables are inherited.
- Otherwise `ORCA_WORKTREE_ID` or `ORCA_WORKSPACE_ID`: retained Orca trial adapter.
- Otherwise: standalone workmux/board, including board wake hooks.

The Orca extension returns before registering hooks, commands or its status bar outside Orca. Exec instructions and coordination modules follow host selection. The explicit Orca library remains importable; it is not the default outside Orca. This is the smallest reversible treatment of the Orca trial, not its removal.

Autoread defaults to the existing private Pi RPC reader in Paseo and standalone. It clears host identity in its child environment and retains context/model routing and structured submission results. BB visible-reader parity required native fork/compact and is deferred. Native Paseo Pi support is documented; compatibility with this Pi build, these extensions, and observational memory has **not** been live-verified.

## Native boundary inspected

Inspected upstream main on 2026-09-22 (reported commit `91d9cf1dbd0c095c8971d7e8f1fb73eb60a6a786`): [CLI](https://paseo.sh/docs/cli), [orchestration](https://paseo.sh/docs/orchestration), [providers](https://paseo.sh/docs/providers), [worktrees](https://paseo.sh/docs/worktrees), and raw `public-docs/{cli,orchestration,providers,orchestration-workflows,worktrees}.md`. Implementation sources under `packages/cli/src/`: `commands/agent/run.ts`, `commands/workspace/{index,create,shared,archive}.ts`, `utils/provider-model.ts`, `output/json.ts`; Pi thinking IDs in `packages/server/src/server/agent/providers/pi/agent.ts`.

The adapter uses these actual flags and unwrapped JSON shapes:

```text
paseo workspace create --isolation worktree --path CWD --mode branch-off
  --new-branch RUN/HANDLE [--base REF] --json
=> {workspaceId, cwd, isolation, ...}
paseo run --background --workspace ID --provider pi --model PROVIDER/MODEL
  --thinking EFFORT --title RUN/HANDLE --json -- PROMPT
=> {agentId, cwd, provider, status, ...}
paseo workspace archive ID --json
```

Workspace and agent creation are separate so failed agent creation retains the workspace receipt. CLI timeouts/nonzero exits/malformed output stop the wave and retain raw evidence. No uncertain creation is retried. Prompts use argv (including a `--` delimiter); extremely large assignments remain subject to OS argv limits. There is no evidence here of a native admission limit/queue to rely on: every backend requires a serialized, parent-scoped `maxConcurrent` and `active` budget.

Paseo CLI-created agents inherit the caller parent ID; explicit workspace placement preserves that relationship. Use native `wait`, `logs`, `send` and completion notifications. Questions use `paseo send PARENT_ID --no-wait "question"` so the worker does not wait for the parent turn to finish. A finished turn is not a finished assignment. See [dispatch and integration](dispatch.md).

## Verification and remaining prerequisites

Paseo was absent from PATH. No daemon was installed or started, no provider/user settings were changed, and no live resources were created or retired. CLI source inspection and isolated executable fixtures exercised prompt/argument fidelity, exact base, native handles, parent budget, partial launches, malformed failure output and no retry. Host tests exercise precedence, hook suppression and local reader selection; Git fixtures exercise integration before archive and `keep`.

Run the local replay:

```sh
bun install --cwd lib/outline-read --frozen-lockfile
bun test lib/paseo.test.ts lib/execution-host.test.ts lib/dispatch.test.ts lib/route-assignment.test.ts extensions/exec/modules.test.ts
bun test lib extensions/exec extensions/orca
tsc --noEmit
git diff --check
```

Observed checks: `bun test lib extensions/exec extensions/orca` passed 158 tests, skipped 2 (live workmux and selected-vault snapshot), and failed 0. A subsequent malformed-success-receipt replay passed all 5 Paseo fixture tests. `git diff --check` passed.

The outline-read dependency install is checkout-local. Typecheck was compared with an archive of the exact baseline using the same dependencies: both report the same 63 diagnostic lines (missing Obsidian typings, root TypeScript resolution and existing tracker test typing). No package lint script is configured; semantic/live-model lint was not run. The initial module replay lacked `web-tree-sitter`; the checkout-local locked install resolved that failure.

Before a live trial, the user must provide:

1. A Paseo CLI and running host matching the inspected commands, with native Pi provider available. Check `paseo provider diagnostic pi --json` and `paseo provider models pi --thinking`. CLI access needs no MCP injection.
2. A compatible Pi executable with model credentials, this trial package loaded, and the revised skills/roster in the provider-launched Pi profile. Use a dedicated trial profile if existing sessions must stay unchanged; verify the daemon uses that profile for both parent and children. A parent-only package override does not configure daemon-launched children.
3. A disposable registered repository/checkout for launch, messaging and merge/archive checks. The adapter and integration assume same-host, locally accessible Git paths. No cross-host integration is implemented.
4. A persisted Pi parent session, available reader model, and installed OM path for autoread; or explicitly select `memoryExtension: false`. Test compaction and structured submission with this Pi/Paseo combination before relying on them.

Then, in a Paseo-owned Pi session on the disposable checkout:

```ts
// exec: use an authenticated model/effort from the native Pi catalog.
state.launch = notify(dispatch.dispatch([{
  handle: "smoke", prompt: "Do not edit files. Report done with your cwd and parent agent ID.",
  model: "<provider/model>", effort: "high", base: "<exact disposable repo commit>"
}], { run: "paseo-smoke", maxConcurrent: 1, active: [] }), "smoke launch");
// Later:
state.wave = await state.launch; show(state.wave);
```

Use the returned ID with `paseo wait ID`, `paseo logs ID`, and `paseo send ID --no-wait "Report needs-input with a question to the parent"`. Check native parent notifications and the actual report, not just idle status. In a separate bounded edit, inspect/accept its commit, call `dispatch.integrate(handle, {keep: true})`, verify the Git result, then explicitly archive that disposable workspace. Test `autoread.run` separately; launch success does not establish reader/OM compatibility.

## Deferred installation / cutover

No cutover was performed. All revised skills are real tracked files in this worktree:

- `skills/enabled/all/mlegls/orchestrations/{multi-agent,dispatch,merge,supervise}/SKILL.md`
- `skills/enabled/pi/mlegls-pi/SKILL.md`

The skill tree was inspected before edits. Its unrelated `conventions/setup-project/references/lints/jev-lint` symlink was not followed or modified. Live `~/.pi` skills, `~/.config/system-config`, global Pi/Paseo settings, the main checkout, and existing Orca runs/workers were left unchanged.

When ready, the user should integrate this branch into the chosen package checkout, review the live skill symlinks and the installation convention in `~/.config/system-config`, then install/repoint only the intended tracked skills and package. Do not run agents-apply or replace shared links as part of an isolated trial. The package metadata alone does not install these enabled user skills. Reload/restart only the Pi sessions intended to adopt the new hooks; `/exec-reset` alone does not reload host extensions. Existing Orca sessions can remain on their current configuration until explicitly migrated. Rollback is the previous package/skill revision and a reload of only the opted-in sessions.
