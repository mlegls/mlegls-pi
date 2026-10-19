# mlegls-pi

A personal [pi](https://github.com/earendil-works/pi) package, plus user-level skills, worker agents and harness
prompts for pi, Claude Code and Codex.

## Layout

**pi package** (entrypoints listed explicitly in `package.json` under `pi`):

- `extensions/system-prompt`: the short system prompt.
- `extensions/fragment`: `read`/`grep`/`edit` over pi's built-ins, with outlines for large files and edits addressed by quoting. `extensions/hashline` is the anchor-addressed alternative; enable one of the two.
- `extensions/workspace`: move a session to another workspace.
- `extensions/bb`: pi's session commands and notices when bb runs pi in RPC mode.
- `extensions/context`: observational memory (`om/`, vendored from pi-observational-memory), journal, recall and context policy.
- `extensions/stances`: `stance/<agent>` virtual models, routed by each agent's model list and `allocation.json`.
- `extensions/supervision`: the `dispatch`, `integrate`, `retire` tools and `/jump`.
- `extensions/guard`: refuses host-wide pattern kills and git-hook bypasses.
- `extensions/error-images`: strips images from errored tool results.
- `lib/session-meta/host.ts`: session metadata host extension.
- `skills/enabled/pi/{pi,mlegls-pi}`, `prompts/`, `themes/`: package skills, prompts and themes.

**Libraries** (`lib/`):

- `dispatch.ts`, `wm.ts`, `thread/`: launch and track `wm` workers (bb threads: a worktree and a pi run by bb).
- `reconcile/`: the execution-tree reconciler behind the `reconcile` tools.
- `tracker*.ts`, `records/`, `outline-read/`, `allocation.ts`, `decide.ts` (Jev decisions outside pi), `desk.ts` and the rest.

**User-level, linked into each harness**:

- `skills/enabled/{all,claude,codex,pi}`: user skills, by harness.
- `agents/`: worker agent definitions (`agents/roles/` for reconciler phases).
- `agent-prompts/`: shared harness prompts.

**Other**:

- `bin/`: `bb-pi` (pi as bb's Pi provider), `heavy` (host-wide queue for heavy work), `ab desk` / `desk`.
- `bb/tracker`: a bb plugin with Issues and Campaigns pages over the tracker.
- `extensions/obsidian-tracker`: the Obsidian tracker view; its `dist/` is symlinked into the vault's plugins.
- `docs/issues/`: the tracker. `docs/guide/` and the other `docs/*.md`: how-tos and design notes.
- `routing.md`, `allocation.json`: model catalog, stance definitions and delegated capacity.

## Setup

Install the pi package, from git or from a local checkout:

```sh
pi install git:github.com/mlegls/mlegls-pi
# or
git clone https://github.com/mlegls/mlegls-pi && cd mlegls-pi
bun run setup        # or: mise run setup
pi install ./
```

That loads the extensions, package skills, prompts and themes. After changing extension code, `/reload` or restart
pi.

The user-level skills, agents and prompts are not part of the package. To use them, symlink the directories you want
into each harness's own skills and prompt locations (for example `skills/enabled/all/*` and `skills/enabled/pi/*` into
`~/.pi/agent/skills/`). They assume this personal setup (bb, `wm` workers, the tracker), so expect to adapt them.

Keep `package.json` valid JSON: if pi cannot parse the manifest it falls back to scanning all of `skills/`.

## Development

- `mise run test`: the full suite, queued behind the host's heavy slots (needs `bin/heavy` on `PATH`).
- `bun test <file>`: one file.
- `bun run typecheck`: `tsc --noEmit`.
- Tracker CLI tests: `bun test --cwd skills/enabled/all/mlegls/conventions/tracker/scripts`.

## Agent model lists

Each agent file's `model:` is a list of `provider/model:effort`, most preferred first. Routing takes the first entry
whose provider has delegated capacity left (`allocation.json`, `lib/allocation.ts`). The catalog and stance
definitions are in `routing.md`.
