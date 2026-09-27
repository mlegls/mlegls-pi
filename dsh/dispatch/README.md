# Preset-routed children

From the repository root:

```sh
bun run setup
bun run --cwd dsh setup
# DEEPSEEK_API_KEY must already be exported.
bash dsh/dispatch/run.sh web --no-open --host 127.0.0.1 --port 0
```

The launcher uses a checkout-owned `dsh/.local/dispatch` home, clears inherited
Pi session identity, and resolves local plugin paths inside preset documents.
Override `DSH_HOME` with another directory under `dsh/` for an isolated run.
Select this checkout as the Web workspace; if the picker is unavailable, stop
Web, run `DSH_HOME="$PWD/dsh/.local/dispatch" bun dsh/add-workspace.ts "$PWD" dispatch`,
and restart. Keep the printed login token private.

In a Hashline session's `run_code` program:

```ts
const handles = await Promise.all([
  { assignee: 'agent:research', prompt: 'Read package.json and report the test command.' },
  { assignee: 'agent:research', prompt: 'Read routing.md and summarize its stance choices.' },
].map(a => tools.dispatch(a)));
console.log(handles);
```

Omit `assignee` for automatic routing. `lib/route.ts` reads the existing
`routing.md`; preset defaults supply model and effort, while explicit model
assignments remain binding. Only registered provider adapters are eligible.
`dispatch.yml` declares research (read-only allowlist) and fill (writing)
presets and four active-child admission slots. Capacity rejects; it does not queue.

Dispatch returns after admission, not completion. Each handle includes the child
ID, board topic, preset, model, effort and cwd. The parent subscribes to that
mailbox before publication, waking on `turn-end`, `crashed` or `exited`.
Read results with `tools.board_read({ topic: handle.topic })`. Upstream continuable
children also deliver settlement notices; `send_message` can continue them.
Depth, persistence, cancellation and admission remain upstream responsibilities.

Writing children get a Git worktree from the parent's repository HEAD and a
`dsh/<child-id>` branch. Commit required parent changes before dispatch. The
handle exposes both cwd and branch; the parent owns integration and removal.
Failed preparation removes its worktree only when no durable child exists.
This is cwd isolation, not process or absolute-path isolation.

The narrow `dsh-subagent` Bun patch lets provider preparation select a durable
cwd and preset, and binds that preset on activation. See
[the upstream seam](../../docs/issues/dsh-continuable-child-preset-and-workspace-seam.md).

Without `web`, the launcher runs the headless profile and accepts a prompt.
That profile exits when the parent becomes idle: it is not a persistent host
for idle parent wake or unfinished children. Use Web for fork/join verification.
Rebuild and restart after changing plugin code.
