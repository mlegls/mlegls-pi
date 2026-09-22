# Paseo bounded trial

This branch ports the old BB pattern: native host substitution plus a thin prepared-assignment launcher. It does not port the Orca Run/Task/Dispatch abstraction. The parent owns decomposition, dependencies, capacity and acceptance. There is no scheduler, automatic retry, enrollment or inbox acknowledgment layer.

Implementation baseline: `05ef261674a4e45f2c3d0cb4fa141f452fc46942`, fast-forwarded from the stale checkout before edits. Historical references: `ff22e65` (host-local wm/board replacement), `88ce495` (thin dispatch), `fc8a27e` (visible BB reader), `90f2af3` (BB removal). Later routing, tracker ownership, continuation, integration, supervision and verification policy remain.

## Host behavior

- `PASEO_AGENT_ID`: native Paseo workspaces, agents and messaging, even when Orca variables are inherited.
- Otherwise `ORCA_WORKTREE_ID` or `ORCA_WORKSPACE_ID`: retained Orca trial adapter.
- Otherwise: standalone workmux/board, including board wake hooks.

The Orca extension returns before registering hooks, commands or its status bar outside Orca. Exec instructions and coordination modules follow host selection. The explicit Orca library remains importable; it is not the default outside Orca. This is the smallest reversible treatment of the Orca trial, not its removal.

Autoread defaults to the existing private Pi RPC reader in Paseo and standalone. It clears host identity in its child environment and retains context/model routing and structured submission results. BB visible-reader parity required native fork/compact and is deferred. Native Paseo Pi support is documented; compatibility with this Pi build, these extensions, and observational memory has **not** been live-verified.

## SDK boundary

`lib/paseo.ts` uses the public `@getpaseo/client` API, pinned to **0.8.0**, matching the installed desktop app and daemon. The [SDK reference](https://paseo.sh/docs/sdk/reference) and installed declarations/implementation were checked; current online docs can describe newer capabilities. The CLI is retained for manual inspection and recovery, not programmatic transport.

`paseo.connect(options?)` returns a connected native client. `paseo.withClient(callback, options?)` connects, runs the callback, and closes in `finally`. Closing removes local subscriptions and the connection; it does not stop agents or archive workspaces.

Connection defaults: `PASEO_URL` or `ws://127.0.0.1:6767/ws`, optional `PASEO_PASSWORD`, ten-second connection timeout, automatic reconnect disabled. Explicit SDK configuration overrides these defaults and supports auth headers or relay settings. The adapter does **not** read CLI host selections, pairing stores, daemon-home configuration or establish SSH tunnels. For a nondefault host, explicitly set the endpoint and credentials in both parent and daemon-launched child Pi environments; the adapter does not copy credentials into children. Do not assume it follows the CLI. `PASEO_CLI` is no longer used.

Launch creates a workspace first, then calls its `agents.create`:

```ts
client.workspaces.create({
  requestId, source: {kind: "worktree", cwd, action: "branch-off",
    branchName: "RUN/HANDLE", baseBranch: exactBase}
});
workspace.agents.create({
  requestId, config: {provider: "pi/PROVIDER/MODEL", thinkingOptionId: effort},
  parent: parentAgentId, title: "RUN/HANDLE", prompt
});
```

The base is omitted when unspecified; `none` thinking maps to Pi native `off`. Parentage is explicit from `PASEO_AGENT_ID`, not inferred by the SDK. Prompts are data, without shell interpolation or OS argv limits. Receipts retain native IDs, serializable snapshots and paths, not live client objects. SDK agent statuses `initializing`, `running`, and `idle` are accepted; idle can mean a fast finished turn, not accepted assignment completion. Error/closed snapshots stop the wave and remain in the failure receipt.

Creation stays separate so a failed agent launch retains the workspace. Failures retain both request correlation IDs, branch title, cwd and any observed resources; those IDs are diagnostic, **not idempotency keys**. A timeout or disconnect can follow successful creation. Inspect native state before another wave; never retry an uncertain launch blindly. SDK 0.8 archive errors are returned as data, so the adapter explicitly checks them before reporting cleanup success.

Every backend still requires a serialized parent-scoped `maxConcurrent` and `active` budget. No scheduler or retry layer is added. See [dispatch and integration](dispatch.md).

## Native supervision from exec

Use retained IDs with the SDK, including after an exec reset:

```ts
state.waiting = notify(paseo.withClient(c =>
  c.agents.ref(agentId).waitForFinish()), "worker turn");
// Later, after notification:
await show(await poll(state.waiting));

await paseo.withClient(c => c.agents.ref(agentId).send("Follow-up"));
await show(await paseo.withClient(c => c.agents.ref(agentId).timeline.refetch()));
```

`send` resolves on daemon acceptance, not completion of the recipient turn. A worker can use it to ask its parent without waiting on that parent. Native completion notifications and final `done`/`blocked`/`needs-input` reports remain the reporting convention. Read the outcome and check the assignment criterion: a finished turn is not a finished assignment.

For streaming, retain `await paseo.connect()` and the native timeline subscription, await its `.ready`, then unsubscribe and close in `finally`. Do not return a live handle or subscription from `withClient`: its connection is already closed. Reconnection is opt-in; live timeline delivery does not replay missed history, so explicitly refetch it. Native SDK objects are not durable across an exec reset; IDs are.

## Verification and remaining prerequisites

The CLI was initially absent from PATH, but is bundled at `/Applications/Paseo.app/Contents/Resources/bin/paseo`. A separately authorized system-config change added that directory to the login PATH. The running desktop-managed daemon and CLI report 0.8.0. A read-only SDK connection and `providers.diagnostic("pi")` succeeded on 2026-09-22: Pi 0.85.1, auth config found, status Ready. No daemon was installed/started, provider settings changed, or live agents/workspaces created or retired for this integration.

Isolated public-SDK fixtures replace the CLI fixtures: exact model/prompt/base/parent propagation, native snapshots, parent capacity, partial creation, failed connection/close, archive error data, cleanup, and no retries. They do not establish end-to-end launch or provider-extension compatibility. Host tests exercise precedence, hook suppression and local reader selection; Git fixtures exercise integration before archive, `keep`, and cleanup failure after a successful merge.

Run the local replay:

```sh
bun install --frozen-lockfile --ignore-scripts
bun install --cwd lib/outline-read --frozen-lockfile
bun test lib/paseo.test.ts lib/execution-host.test.ts lib/dispatch.test.ts lib/route-assignment.test.ts extensions/exec/modules.test.ts
bun test lib extensions/exec extensions/orca
tsc --noEmit
git diff --check
```

SDK focused replay: 14 passed, 0 failed. `bun test lib extensions/exec extensions/orca`: 160 passed, 2 skipped (live workmux and selected-vault snapshot), 0 failed. `git diff --check` passed. Typecheck diagnostics remained identical after the SDK change.

The outline-read dependency install is checkout-local. Typecheck was compared with an archive of the exact baseline using the same dependencies: both report the same 63 diagnostic lines (missing Obsidian typings, root TypeScript resolution and existing tracker test typing). No package lint script is configured; semantic/live-model lint was not run. The initial module replay lacked `web-tree-sitter`; the checkout-local locked install resolved that failure.

Before a live trial, the user must provide:

1. A compatible running Paseo host, explicit connection settings if not the local default, and native Pi provider available. The installed 0.8.0 host passed the read-only SDK check; `paseo provider diagnostic pi --json` remains a manual diagnostic. No MCP injection is needed.
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

The skill tree was inspected before edits. Its unrelated `conventions/setup-project/references/lints/jev-lint` symlink was not followed or modified. Live `~/.pi` skills, global Pi/Paseo settings, the main checkout, and existing Orca runs/workers were left unchanged. The separately requested login-PATH change in system-config does not install this integration or migrate sessions.

When ready, the user should integrate this branch into the chosen package checkout, review the live skill symlinks and the installation convention in `~/.config/system-config`, then install/repoint only the intended tracked skills and package. Do not run agents-apply or replace shared links as part of an isolated trial. The package metadata alone does not install these enabled user skills. Reload/restart only the Pi sessions intended to adopt the new hooks; `/exec-reset` alone does not reload host extensions. Existing Orca sessions can remain on their current configuration until explicitly migrated. Rollback is the previous package/skill revision and a reload of only the opted-in sessions.
