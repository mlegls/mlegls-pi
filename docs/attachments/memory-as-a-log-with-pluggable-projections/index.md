# Memory log parent join

Independent verification at `22a49740043b0ea72b858337e44f687d4a8dd17d`: [first-use predictions, observed results and replayable checks](drive-3.md). The supplied backend journey exited 0; main compaction/recall and sibling/fork visibility held.

Tested code revision: `a40d31338c0861f138c56e619cd85dcaea4fee16` (2026-11-09). This packet adds a reproducible first-use setup; no product repair was needed.

The surviving path is records store → `ledgerBranch` → OM projection → budgeted renderer → registered `session_before_compact` result → public `recall` → original source entries. The board retirement (`44cb45f9`), exclusive memory-system ownership (`361bef2a`) and finite OM render budget (`aef5c9cc`) are preserved.

## Setup and reproduction

Required environment: Bun and this checkout's installed dependencies. Backend-only, keyless library journey; no browser, account, live model or deployment. The [drive script](drive.ts) creates a fresh owned temporary project, settings, parent session header and SQLite store for each invocation, then removes them. It initializes the actual context extension against an in-process extension API adapter, invokes its registered compaction callback and registered public recall tool. Observer/reflection outputs and transcript entries are seeded; worker model generation and pi's outer event dispatch are outside this encounter.

Run from the repository root:

```sh
bun docs/attachments/memory-as-a-log-with-pluggable-projections/drive.ts
```

This command was opened/run successfully. No pre-existing store, ignored setup file or secret is required. The isolated target is identified by the script's temporary directory and session ids `join-parent` / `join-fork`. Settings select only OM, set the fold threshold to 1 token to exercise reflections/drops, and set a finite summary budget of 512 estimated tokens. Readiness is established when initialization completes and `activeMechanism(ctx)` returns `om` before the compaction call.

Optional upstream replay uses the existing `replay-upstream.ts`, not worker replay (no paid requests). Install the historical comparison dependency into a disposable home, then pass it to the same entry point:

```sh
upstream=$(mktemp -d)
mkdir -p "$upstream/.pi/agent/npm"
bun add --cwd "$upstream/.pi/agent/npm" pi-observational-memory@3.1.4
OM_UPSTREAM_HOME="$upstream" bun docs/attachments/memory-as-a-log-with-pluggable-projections/drive.ts
rm -rf "$upstream"
```

The original package was absent on this host. The observed comparison used 3.1.4 installed under `/tmp/memory-log-join-upstream`, subsequently removed. The script generates a legacy-format session from its seeded ledger and invokes the existing replay with a scratch HOME/store. Its unbounded upstream comparison is separate from the registered mechanism's 512-token render cap.

## Observed first use

| Claim | Action | Observed result |
|---|---|---|
| Shared immutable store backs OM | Write an observation at `a2`, a reflection over it, then an observation and drop at `a3` | Four `om` rows; zero transcript `om.*` custom entries. Store path is under the owned temporary directory. |
| Registered OM compaction survives the join | Call the context extension's registered `session_before_compact` callback with the main branch and `keep` cut point | OM is the active compaction owner. Result has `om.folded` details, no composed `sections`; summary is 263 estimated tokens under the 512-token budget. It renders the reflection and later observation, omitting the dropped observation. |
| A rendered id reaches original turns | Extract `bbbbbbbbbbb1` from the returned summary and execute public `recall` | Status `ok`; reflection → observation `aaaaaaaaaaa1` (dropped) → source ids `a1,a2`. Returned text includes `Use the records store for immutable memory.` |
| Sibling rendering follows ancestry | Switch to `[a1, sibling]`, before the `a2` anchor | No OM compaction section. Public recall of the reflection falls back to its global raw record, showing tags and edges, without source expansion. Global lookup is the current recall contract; it is distinct from branch-scoped OM recall and interactive rendering. |
| Fork inherits at the fork point | Switch session id to `join-fork`, header `parentSession` to the parent file, branch `[a1,a2,fork]` | Renders inherited observation `aaaaaaaaaaa1` and reflection `bbbbbbbbbbb1`; excludes later observation `aaaaaaaaaaa2`. Recall reaches `a1,a2`; inherited observation is active because the later drop at `a3` is invisible. Lookup of the later observation has only the global raw-record fallback. |
| Upstream replay still agrees | Run existing replay over the generated seeded legacy session | `files:1, compactions:1, recalls:3, diffs:0, entries:4, rerun:0`. Migration is idempotent; render/details, clocks, fold and recalls agree with upstream. |

Existing checks run:

```sh
bun test extensions/context/om/session-ledger/store.test.ts lib/records/cursor.test.ts extensions/context/mechanism.test.ts
```

8 passed, 0 failed, 28 expectations. These cover ledger splicing, branch/fork inheritance, legacy migration, branch/fork cursors and exclusive surface selection. No new permanent acceptance tests were added.

## Child deliveries and historical acceptance

- `13f2a09d`: shared SQLite records store and board adapter. The completed `move-the-board-onto-a-records-store` Result records all 4,908 historical board messages round-tripping and a dispatch/report/integrate smoke. Board acceptance is historical: the board was subsequently retired.
- `7af867f5`: OM as records, branch-aware ledger adapter and vendored agents/prompts. The completed `observational-memory-as-the-om-schema` Result records 88 real sessions, 307 compactions, 25,584 recalls and zero upstream differences, plus live compaction and source recall.
- `28f859e2`, `1779e7c7`: renderer/branch/cursor extraction and board delivery cursors. The completed `renderers-over-the-records-store` Result records 67 real sessions, 274 compactions, 19,912 recalls and zero differences, branch/fork cursor checks and live composed-path compaction.

Those child Results remain the evidence for historical migration, retired board behavior and real model-driven encounters. This parent encounter establishes the surviving join at the current code revision with seeded model outputs.

## Result

No surviving seam required a product change. The parent can join its completed children with this current first-use evidence and reproduction entry point.

**Door:** two-way; this delivery adds only the evidence/setup packet.
**Blast radius:** documentation; the script writes only to its owned temporary directory. No servers or external targets remain running.
