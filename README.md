# mlegls-pi

Personal pi package, plus the user-level skills, worker agents and harness prompts that
`~/.config/system-config` links into each harness.

The model's outer loop is pi's built-in `codemode`: scripts call every tool through `tools.*`,
including the hashline `read`/`grep`/`edit` this package registers over the built-ins.
Computer use is MCP (`cua-driver mcp`, `chrome-devtools-mcp`) reached the same way; Jev
decisions are codemode's built-in `models.classify` (`lib/decide.ts` for code outside pi).

- `extensions/system-prompt`: the short system prompt.
- `extensions/workspace`: switch a session's workspace.
- `extensions/context`: context policy (the worker fence) over pi-observational-memory, the compaction mechanism.
- `extensions/stances`: `stance/<agent>` virtual models routing by each agent's model list and `allocation.json`.
- `extensions/supervision`: `dispatch`, `integrate`, `retire` tools and `/jump`.
- `extensions/hashline`: anchored `read`/`grep`/`edit` over the built-ins (`lib/outline-read`).
- `lib/board`: shared pubsub log for coordinating sessions, with `board_*` and `mail` tools; every session has a mailbox topic.
- `lib/dispatch.ts`, `lib/wm.ts`: launch ready waves of `wm` workers (workmux worktree + tmux window).
- `lib/tree`: the tmux dashboard and Ghostty sidebar, `ab tree ui [--sidebar]`; `bin/ab-nav` is window history.

The prototype this replaces (exec cells, the bash outer loop, the `ab` program, supervise
loop, memory log) is tagged `prototype`.

## Development

`bun run setup`, then `bun test`. Tracker CLI tests run in their own package:
`bun test --cwd skills/enabled/all/mlegls/conventions/tracker/scripts`.

User skills live under `skills/enabled/{all,claude,codex,pi}`, worker agents under `agents/`, and
shared harness prompts under `agent-prompts/`. Package skills are only `skills/enabled/pi/pi`
and `skills/enabled/pi/mlegls-pi`. Keep `package.json` valid JSON: pi falls back to scanning
all of `skills/` if it cannot parse the manifest.

## Agent model lists

Each agent file's `model:` is a list of `provider/model:effort`, most preferred first. Routing
takes the first entry whose provider has delegated capacity left (`allocation.json`,
`lib/allocation.ts`). The catalog and stance definitions are in `routing.md`.
