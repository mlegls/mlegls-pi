---
stage: goal
assignee: human
author: session:e780584f-b8ad-4f4f-9b9d-6de74973d067
priority: 3
---
Run agents on [@earendil-works/pi-durable](https://github.com/earendil-works/pi/tree/main/packages/durable) instead of pi's \`AgentSession\`: first the nodes of supervision trees, then interactive sessions once upstream's server cuts over. Came from asking how to move non-interactive agents off the pi TUI, and how the extensions would have to change to be shared between interactive and non-interactive sessions.

Upstream already draws that line. \`packages/coding-agent/src/experimental/\` (at \`7fbbd5f\`, 2026-10-01) has \`pi server\` → one worker process per Session (durable \`Harness\` over \`session.sqlite\`) → \`pi client\`s attaching over chord. A plugin package has a **session facet** (\`src/session.ts\`, runs where the Harness is) and a **TUI facet** (\`src/tui.ts\`, runs where the terminal is): VS Code Remote's \`extensionKind: ui | workspace\`. Interactive stops being a property of an agent; it's a durable Session with a client attached. So no adapter layer targeting both \`ExtensionAPI\` and durable: host-neutral cores, thin adapters, and the session-side code written as durable \`Extension\`s packaged like upstream's session facets.

## destination

A supervision tree is the supervisor's own Session: root conversation = supervisor, the reconciler a durable task, each worker a conversation that task owns, its worktree as \`cwd\`. Ownership is real (abort, idle, task graph across the tree; each reconciler becomes a node of the tree, so its death is visible, where today its workers sit flat under the owner session and a dead reconciler shows nowhere), \`/jump\` becomes switching conversations in the client, the per-tree host is just the Session worker that \`pi server\` keeps alive or restarts. A non-session thread kind for reconcilers in today's zmx thread registry was considered and dropped: this move replaces that layer. One Session per worker was the alternative: separate blast radius and storage, but no ownership, and all of today's polling glue stays.

Until then, interactive sessions stay on the stock pi TUI and tree nodes move first (below).

## the board over durable

The board keeps its primitives (topics, tag expressions, subscriptions, \`board_read\`). Routing stays: run-wide decisions, worktree/ticket scopes and mailboxes are many-to-many and interest-based. Delivery (cursor, pending/seen records, 1s poll, \`isIdle\`, \`sendMessage(triggerTurn)\`, \`before_agent_start\` injection in \`lib/board/host.ts\`) becomes the durable inbox:

| board | durable inbox |
|---|---|
| wake: deliver when idle, start a turn | \`submit({type:"input"})\`, queued as follow-up while busy |
| steer at the next turn boundary | \`whenBusy: "steer"\` |
| quiet: attach at the next user turn | no exact match: a \`write\` is seen at the next request, possibly mid-run; or hold until the next input |
| withdraw once read through \`board_read\` | \`submission.abort()\` |
| cursor and seen | \`requestId: "board:" + msg.id\`: exactly-once across crashes |

Within a tree, the reconciler's control flow runs on ownership rather than on parsing turn-end reports off \`run/handle\` and the child monitor's live files: the owning task sees the worker's submission settle; abort and idle propagate. Reports still go to the board so they stay observable. The board log remains the only cross-process medium: between trees, between interactive sessions, from scripts.

## interim: tree-host

Worth building only if worker pain is pressing; otherwise do the port and wait for upstream.

- Port what's needed regardless: tools, prompt, context system, model routing, as durable \`Extension\`s.
- Generalize the reconciler's process (\`lib/reconcile/main.ts\` starts one per root issue today) into a tree-host: one per campaign, a manual dispatch wave being a campaign without a tracker tree. Lay it out like an upstream Session: a directory with \`meta.json\` and \`session.sqlite\`, the reconciler task, a root conversation that for now stands in for the external legacy owner and talks to it over the board. Later the real supervisor conversation takes that place; the storage shape doesn't change.
- Launch it in a zmx terminal running the experimental durable TUI (\`/agents\`, \`/tasks\`) to look at it. No viewer or server of our own. This means tracking a pi source checkout: server, client and experimental subpaths are excluded from npm.
- Waking a stopped host on mail is [[projects/mlegls-pi/issues/idle-thread-reaping-needs-external-board-wakes]]'s activator; upstream's server would own it.

## porting map

| ours | today | durable |
|---|---|---|
| \`extensions/system-prompt\` | \`before_agent_start\` → systemPrompt | \`section()\`s; upstream's \`experimental/durable/prompt.ts\` already builds pi's prompt (tools, rules, AGENTS.md, skills, cwd) |
| \`extensions/hashline\`, \`fragment\` | \`registerTool\`, ledger rebuilt from \`appendEntry\` + \`getBranch\` | \`defineTool\`, ledger as a conversation doc (\`fork: "asOf"\`) |
| \`context\` elide, journal rendering | \`context\` / \`context_with_system\` | \`GenerationTask.beforeRequest\` |
| \`context\` journal checkpoint, OM | \`session_before_compact\` | \`CompactionTask.beforeCompact → {summary}\`; OM's observer/reflector calls as durable tasks |
| \`context\` fence | \`turn_end\` steer, \`agent_end\` compact, gated on \`PI_BOARD_TOPIC\` | \`afterTools\` hook → \`submit({whenBusy:"steer"})\`, \`compact()\` |
| \`lib/board/host.ts\` | above | host-side routing → inbox; report on submission settle, keyed by submission id (not in \`onYield\`: hooks rerun on recovery) |
| \`lib/session-meta/host.ts\` | live files, child monitor | \`viewState()\` / \`taskGraph()\` |
| \`extensions/workspace\` | \`SessionManager.forkFrom\` + \`switchSession\` | \`configure({cwd})\` |
| \`extensions/supervision\` | \`dataTool\` | \`defineTool\`; \`/jump\` → client conversation switching |
| \`extensions/stances\` | \`registerVirtualModel\` | gap: routing lives in \`AgentSession\`, durable generation never calls \`route()\`; a delegating pi-ai provider |
| commands, \`ui.notify\`, status, renderers | | TUI facet only |

What helps on either host, so worth doing first: state as data (per-conversation docs, not \`getBranch()\` scans), side effects idempotent by a stable id, presentation in its own modules. The context system's seam is \`BranchSession\` in \`lib/records/branch.ts\`, implementable over a durable \`Conversation\` (conversation id, last entry id, active entries, fork parent); durable branches only by forking, which makes "visible = \`at\` ∈ ancestors" simpler.

## holes

- **Journal cut point.** Durable's \`beforeCompact\` returns only \`{summary}\` or decline; the journal picks its own cut (\`keepFrom\`, \`extensions/context/journal.ts\`). Try: decline, then commit our own \`pi.compaction\` entry heading where we want. Check the spec allows it. OM's session-ledger also reads pi-style \`firstKeptEntryId\`.
- **Stance routing** through a delegating provider: does the sticky choice survive, so provider caches stay warm?
- **Codemode** isn't ported to durable: one non-replay-safe tool whose nested calls run in-process. MCP, prompt templates and image reads are missing too.
- **Board delivery over the inbox**: exactly-once wakes, and what quiet subscriptions become.
- **Version**: we're on pi 0.99.1; 1.0.0 shipped 2026-10-01. The bump comes first.

These are one spike: a headless worker on durable with hashline tools, the prompt sections, the fence, the board bridge and a stance provider; kill it mid-tool and resume.

## cutover signals

Commit to moving interactive sessions when upstream shows:

- \`pi server\` / \`pi client\` out of \`PI_EXPERIMENTAL\` and shipped on npm (CHANGELOG; the experimental subpaths stop being excluded).
- A documented extension surface on durable: \`docs/extensions.md\` covering session/TUI facets, or \`ExtensionAPI\` reimplemented over the registry, with a migration path.
- The services README TODOs closed: subagent conversations as keyed services (what \`/agents\` over the server needs), tree navigation through forks, transcript paging.
- Parity for what we rely on: codemode, MCP, virtual models, images, \`/login\` on the durable path.
- Storage stability: the durable README's "Experimental. The API changes without notice" gone, and real migrations (the handoff doc still says "SQLite schema edited in place; no migrations while WIP").
- Import of existing JSONL sessions, or a stated decision that old sessions stay on the old runtime.
- The server waking sleeping Session workers on external events, which would retire our activator.

## decisions

- 2026-10-02: one Harness per supervision tree (the supervisor's Session), not one per worker or one machine daemon.
- 2026-10-02: adopt upstream's server and clients rather than building our own; interim viewing through zmx and the experimental durable TUI.
- 2026-10-02: the board stays the single messaging surface; within a harness it routes onto the durable inbox, and tree control flow uses ownership.
