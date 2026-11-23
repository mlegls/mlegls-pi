# mlegls-pi

Personal [pi](https://github.com/earendil-works/pi) package, plus user-level skills, worker stances and harness prompts for pi, Claude Code and Codex.

## Layout

**pi package** (entrypoints in `package.json` under `pi`):

- `extensions/agents`: named agents with a soul, private skills and a machine-wide life; see [Named agents](#named-agents).
- `extensions/system-prompt`: short system prompt.
- `extensions/fragment`: `read`/`grep`/`edit` over pi's built-ins, with outlines for large files and quote-addressed edits. `extensions/hashline` is the anchor-addressed alternative; enable one.
- `extensions/workspace`: move a session to another workspace.
- `extensions/task`: isolate interactive edits in task worktrees (`ab task`).
- `extensions/bb`: Pi session commands (`/jump`) and completion-notice filtering when BB runs Pi in RPC mode.
- `extensions/context`: shared lives and notes, observational memory (`om/`, vendored from pi-observational-memory), journal, recall and context policy.
- `extensions/stances`: `stance/<agent>` virtual models, routed by each agent's model list and `allocation.json`.
- `extensions/guard`: refuses host-wide pattern kills and git-hook bypasses.
- `extensions/error-images`: strips images from errored tool results.
- `lib/session-meta/host.ts`: session metadata host extension.
- `skills/enabled/pi/{pi,mlegls-pi}`, `prompts/`, `themes/`: package skills, prompts and themes.

**Libraries** (`lib/`):

- `dispatch.ts`, `thread/`: launch and track workers as BB threads in worktrees.
- `reconcile/`: execution-tree reconciler and backend for the [BB Supervision plugin](docs/guide/bb-supervision.md).
- `tracker*.ts`, `records/`, `outline-read/`, `allocation.ts`, `decide.ts` (Jev decisions outside pi), `desk.ts`, `task.ts`.

**User-level, linked into each harness**:

- `skills/enabled/{all,claude,codex,pi}`: user skills, by harness.
- `agents/`: worker stances (`agents/roles/` for reconciler phases).
- `agent-prompts/`: shared harness prompts.

**Other**:

- `bin/`: `bb-pi` (pi as bb's Pi provider), `heavy` (host-wide queue for heavy work), `ab` / `desk`, `host-for-human`.
- BB plugins (`supervision`, `tracker`, `thread-share`) live in [mlegls/bb-plugins](https://github.com/mlegls/bb-plugins), cloned at `~/dev/bb-plugins`.
- `extensions/obsidian-tracker`: Obsidian tracker view; its `dist/` symlinks into the vault's plugins.
- `docs/issues/`: tracker. `docs/guide/`, `docs/stories/`, and `docs/*.md`: guides, stories and design notes.
- `routing.md`, `allocation.json`: model catalog, stance definitions and delegated capacity.

## Skills

`skills/enabled/<harness>/` holds skills for every harness (`all`) or one (`claude`, `codex`, `pi`). Every directory containing a `SKILL.md` is a skill named by its directory:

- `all/mlegls/`:
  - `lifecycle/`: `introduce`, `orient`, `shape`, `implement`, `simplify`, `verify-story`, `garden`, `advance`.
  - `orchestrations/`: `multi-agent`, `dispatch`, `merge`, `supervise`, `tend`.
  - `conventions/`: `tracker` (CLI in `scripts/`), `project-docs`, `testing`, `writing-skills`, `attention`, `outreach`, `setup-project`.
  - Standalone: `grill`, `devils-advocate`, `what-else`, `variety`, `leverage`, `profile`, `retro`, `artboard`.
- `all/cua-driver/`: vendored from [Cua](https://github.com/trycua/cua) (see `UPSTREAM.md`).
- `all/humanlayer/`, `all/matt-pocock-edited/`: adapted from external collections.
- `pi/pi`, `pi/mlegls-pi`: package skills loaded via `package.json`.

Harnesses expect a flat skills directory, so symlink each skill directory itself rather than its parent grouping directories. `.agents/skills/` and `.claude/skills/` are this repo's project skills, installed from `skills-lock.json`.

## Setup

```sh
pi install git:github.com/mlegls/mlegls-pi
# or locally:
git clone https://github.com/mlegls/mlegls-pi && cd mlegls-pi
bun run setup        # or: mise run setup
pi install ./
```

Reload (`/reload`) or restart pi after editing extension code. Keep `package.json` valid JSON: if pi can't parse it, it falls back to scanning all of `skills/`.

User-level skills, agents and prompts are outside the package; symlink each skill directory you want into the harness's skills directory (e.g. `~/.pi/agent/skills/`). They assume this host setup (bb, worktree workers, the vault tracker).

## Host health

Run `bun lib/doctor.ts` to check host packages, settings paths, CLIs and credentials. The bb extension also runs it in the background on first use and once every 24 hours per host, filing tracker issues for gaps. See [Host doctor](docs/guide/host-doctor.md).

## Development

- `mise run test`: full suite, queued behind `bin/heavy`.
- `bun test <file>`: single test file.
- `bun run typecheck`: `tsc --noEmit` (run `bun run setup` first so `extensions/obsidian-tracker/` has its Obsidian API types).
- `bun test --cwd skills/enabled/all/mlegls/conventions/tracker/scripts`: tracker CLI tests.

## Named agents

`agents` in `~/.pi/agent/settings.json` (or `.pi/settings.json`) lists registry directories, e.g. `"agents": ["~/dev/mmon/concept/agents"]`. Each `<registry>/<name>/SOUL.md` holds `description` and `model` frontmatter with the soul as its body; private skills live in `<registry>/<name>/skills/<skill>/SKILL.md`. The first registry directory naming an agent wins. Keep agent files in the repository the agent belongs to.

Start with `pi --model agent/<name>`, or pick `agent/<name>` in BB or an automation. Identity is attachment to `/life /<name>`: changing model keeps it, `/life off` ends it, and selecting `agent/<name>` in a session that already has messages only prompts you to attach with `/life /<name>`. Soul and skills are read each run; model-list edits need `/reload`. See [life/README.md](extensions/context/life/README.md#named-agent-first-use).

## Agent model lists

Each agent's `model:` is a preferred-first list of `provider/model:effort`. Routing picks the first entry whose provider has delegated capacity left (`allocation.json`, `lib/allocation.ts`). Stances and the active catalog live in [routing.md](routing.md).
