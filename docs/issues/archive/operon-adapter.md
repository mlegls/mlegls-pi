---
tags: [task]
status: x
next: done
parent: "[[projects/mlegls-pi/issues/agentic-setup-reorg]]"
---

operon (obsidian task and project management "for humans and agents": calendar, kanban, task records, time tracking) as the tracker instead of the custom vault frontmatter. research what its agent interface actually is — CLI, API, or frontmatter conventions — and whether the vault adapter's model (`next`, `blocked-by`, `part-of`, derived frontier) maps onto its records. one adapter in the tracker skill either way.

## answer

researched against Operon plugin 1.6.1 (2026-06-21, GPL-3.0, source public) and `@stratejya/operon-cli` 1.2.0 (npm tarball, schemas read directly).

### interface: CLI + in-process plugin API; no HTTP, no MCP

Operon has one versioned domain contract, **Runtime API V1**, served through exactly two public channels:

- **`operon-cli`** — out-of-process, for "humans, local agents, skills, scripts, and command-line integrations". A thin client: it holds no task copy, reaches Operon inside a *running* Obsidian through Obsidian's official CLI over a local owner-only transport (a Unix-domain socket, `net.createServer`). Vault profiles (`operon setup --name main`), human lines by default, `--json` for scripts, `operon manifest --json` + `schemas/v1/*.json` as the authoritative contract. Persistent machine protocol: `operon session --jsonl` (one JSON object per line; reads may be grouped 2–8 at a time from exactly `health`, `task.get`, `tasks.query`, `context.build`; mutations never grouped; post-apply uncertainty is exit 5 + `planRef` recovery).
- **In-process Developer API** — for another *Obsidian plugin* in the same process, via `getDeveloperApiV1()` on the live Operon plugin instance, with per-capability grants. Type-only TS entrypoints ship in the CLI package; no JS SDK, no transport.

Neither is a remote API. `contracts/agent-runtime/public-v1-scope.md` explicitly excludes **"HTTP or MCP servers"**; the Developer API docs repeat it (no remote/HTTP/MCP/mobile API). There is no MCP server anywhere in the repo or docs.

Third, supported-but-unversioned path: **editing the Markdown directly**. Tasks are plain Markdown/YAML; "the file is the task". No health signal, no capability list, no verified apply.

Constraints that matter for our adapter: everything live needs **Obsidian Desktop running**; macOS supported, native Linux/Windows 11 public beta, **WSL unsupported**, mobile outside the Runtime. So this is not usable headless/CI without a desktop Obsidian.

### record schemas

**Task** — one record in two representations, same canonical keys:

- inline: `- [ ] text {{operonId:: abc1234}} {{key:: value}} …`; file: frontmatter, visible names renameable via Key mappings.
- identity `operonId`: 7 chars `[a-z0-9]`, durable, system-owned, mutation-gated; `validity` canonical|legacy-invalid|duplicate.
- checkbox: `open|done|cancelled`; workflow `{pipeline,status}` from the live catalog (`Pipeline.Status`), `isFinished/isCancelled/isScheduledTarget/isTrackingTarget`.
- Catalog canonical keys (from `src/types/keys.ts`, order-preserving): `operonId, status, taskType, priority, dateDue, dateScheduled, dateStarted, datetimeCreated, dateCompleted, dateCancelled, datetimeStart, datetimeEnd, estimate, duration, totalEstimate, totalDuration, repeat, repeatSeriesId, repeatOccurrenceDate, datetimeRepeatEnd, parentTask, blocking, blockedBy, assignees, contexts, progress, {direct,tree}{Subtask,Descendant}Count, {direct,tree}{Done,Open}*Count, reminderDatetimes, reminderRules, timezone, trackers, activeTracker, related, taskIcon, taskColor, note, location, links, taskImage, taskGallery, datetimeModified` + custom keys.
- Runtime task DTO (`context.schema.json#taskContext`): `identity, description, representation, locator, checkbox, workflow, priority, dates{due,scheduled,started,completed,cancelled}, datetimes{start,end,created,modified}, relationships{parentOperonId,childOperonIds,blockingOperonIds,blockedByOperonIds,relatedOperonIds}, recurrence{repeating,seriesId,occurrenceDate}, tracker{active,sessionCount}, pinned, sourceRevision, contextRevision`, plus opt-in hydrations `note, links, customFields, sourceMarkdown, trackerHistory, reminderItems, writableFields`.
- typed mutations: `createItem`(description, target inline/file, fields, tags, statusId, priorityId, parent, related, dependencies[{relation:blocks|blocked-by}], bodyMarkdown), `updateSpec`, `relationshipSpec` (fields only `parentTask|blocking|blockedBy`), `transitionSpec`, `reminderSpec`, `timerSessionSpec`, `convertSpec`, `relocateSpec`, `deleteSpec`. Writes are preview→seal→apply, 12 mutation kinds.
- per-property: canonicalKey, 6 value types (text/number/date/datetime/list/checkbox), sync policy yes/no/auto, mutationClass general-update|semantic-capability|runtime-owned, mappingStatus.

**Project** — there is no project record. A project is **a parent task tree**: `parentTask` (single operonId) → child/ancestor edges, "project-member" relationship, `project-analysis` context projection, finder `project: direct|tree`. Project *serials* (`PROD-007`) are a display/state layer: a scope = starting parent operonId + 1–5 letter prefix, stored in `.obsidian/plugins/operon/state/project-serials.json`, assigned in creation order per scope, nearest scope wins, never written to the note.

**Session** — two unrelated things:
- *time session*: no separate record; sessions are the `trackers` list on the task, each item `<local-datetime>/<local-datetime>` (e.g. `2026-05-20T09:00:00/2026-05-20T10:30:00`), semicolon-separated, split at local midnight per setting; `activeTracker` is the running start; `duration`/`totalDuration` in seconds; Time Session History view and `timer.session` mutations (add/update/remove) edit them.
- *CLI/agent session*: `operon session --jsonl` — a protocol, not stored.

**State/settings** (not tasks): `.obsidian/plugins/operon/data.json` (key mappings, pipelines, priorities, filters, presets) + `state/{repeat-series,active-trackers,pinned-tasks,project-serials,field-rename-journal,periodic-note-containers}.json` + rebuildable `runtime/index-v8` + `cache/external-calendars.json`; Table presets are vault `.table` files.

### mapping the vault adapter onto Operon

| vault (vault adapter) | Operon | verdict |
| --- | --- | --- |
| `next` (grill|research|…|wait|done) | none; closest is `status` workflow + priority, and `done` ≈ `isFinished` | must become a custom key or a status/pipeline encoding; no session-kind concept in Operon |
| `part-of` wikilink | `parentTask` operonId | direct, but single parent (no part-of DAG) and reference is an opaque id, not a vault link |
| `blocked-by` list | `blockedBy` / inverse `blocking` (list of operonIds), mutated only via `task.relationship` | direct field; Operon even derives active blockers (a blocker counts resolved when `dateCompleted`/`dateCancelled`/terminal status/checkbox) |
| `claimed-by` session | none; `assignees` list is nearest | lossy: assignment ≠ exclusive session lease; no claim, no "unclaimed" derivation |
| `priority` 1|2|3, children inherit nearest root | `priority` = catalog taxonomy (id/label/order/color/icon/isDefault); child inheritance is a per-link copy of `status,priority,taskIcon,taskColor` when `inheritPropertiesOnParentLink` is on (default off) | map 1|2|3 → priority ids (or add custom); nearest-root derivation must be enforced by the adapter |
| derived frontier/mine | not derived by Operon | compute outside: `query`/`context planning-workload` (≤250) over `checkbox=open`, then filter by custom next/claim keys and active `blockedBy` |
| archive/ move to `archive/` | `isFinished` status, optional file-task auto-archive (folder + delay) | replaces the file move |

Lossy vault→Operon: session-kind semantics; step-scopedness of `blocked-by` (vault asks "what does the next step wait on" and re-asks when `next` changes; Operon is a persistent dependency edge/dynamic active-blocker set); claim/lease; nearest-root priority inheritance; wikilink targets (become operonIds); body sections (substeps/holes/decisions) survive only as file-task `bodyMarkdown` or the single multiline `note` field.

Lossy Operon→vault: pipelines/statuses, operonId identity, `estimate/duration/total*` rollups, tracker sessions/time, recurrence series, reminders (2 list fields), timed blocks (`datetimeStart/End`), `taskType/taskImage/taskGallery/icon/color/location/links`, project serials, cancelled checkbox state, catalog custom keys, pinned/active-tracker/repeat-series state, and the whole Runtime contract (health, capabilities, sealed preview/apply, receipts, freshness, `explicit|derived|inferred` provenance, recovery).

### timeline / gantt (for campaign-coordinator)

Exists, as a **mode of an Operon Table preset** (Table toolbar → Gantt View), not a separate view or record. Bars: `dateStarted`→`dateDue` all-day; `datetimeStart`→`datetimeEnd` timed (empty end + `estimate` → effective end); `dateScheduled` alone = one-day; start/scheduled/due markers draggable and write the date field back to Markdown. Dependency lines come from `blocking`/`blockedBy`; "move open descendants with parent" and "move open blocked tasks with their blockers" cascade moves over open descendants only. Preset-owned (toolbar state + divider in the `.table` file), embeddable via `operon-table`, exportable as flat Markdown/CSV of the current preset rows (no group/summary rows).

What it does **not** have: no critical-path/slack/CPM computation, no resource/pool/cost dimension, no duration-based scheduling engine, no server-side or headless rendering. So the coordinator's gantt (critical path, slack packing, per-bar pool annotation) cannot be produced by Operon itself; the machine-readable read closest to workload is the CLI `context` `planning-workload` projection (≤250 tasks). Either compute CPM externally from dates+dependencies (pool as a custom key/tag) or keep the gantt in the board.

### recommendation

One adapter: track `next` and `claimed-by` as Operon **custom canonical keys** (source custom, `general-update`), `part-of`→`parentTask`, `blocked-by`→`blockedBy` (via `task.relationship`), priority→catalog priority ids, and compute frontier/mine in the adapter from `operon query` + `catalog` + active blockedBy. Prefer `operon-cli` (versioned, verified writes, manifest/schema discovery) over direct frontmatter edits, accepting that live reads/writes require a running Obsidian Desktop — the one structural mismatch with agent sessions that run headless.

## sources

- Operon docs: `docs-118` agent runtime overview, `docs-119` install/verify CLI, `docs-121` reading/context, `docs-122` changing tasks, `docs-125` CLI contract & discovery, `docs-126` compact syntax, `docs-127` everyday commands, `docs-129/130/131/132` in-process Developer API, `docs-133` JSONL sessions, `docs-036` agent-friendly workflows, `docs-012` inline task syntax, `docs-018` task properties, `docs-045` markdown storage, `docs-015` identity, `docs-097` project serials, `docs-034/053` time tracking & session history, `docs-044/046` where data lives, `docs-139` gantt view, `docs-111` table export (https://operon.cc/docs/).
- Plugin source: https://github.com/hasanyilmaz/operon @1.6.1 — `src/types/keys.ts`, `src/core/dependency-graph.ts`, `src/systems/tracker-utils.ts`, `src/storage/operon-storage-paths.ts`, `src/types/settings.ts`, `contracts/agent-runtime/public-v1-scope.md`, `contracts/agent-runtime/developer-api-v1.md`.
- CLI: npm `@stratejya/operon-cli` 1.2.0 — `cli-manifest-v1.json`, `schemas/v1/{read,context,common,catalog,mutation,timer,session,capabilities,lifecycle}.schema.json`; source https://github.com/hasanyilmaz/operon-cli.
