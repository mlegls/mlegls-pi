---
stage: ticket
assignee: agent
author: session:01a0f08f-9962-73f5-8231-63e51693973d
part-of: "[[projects/mlegls-pi/issues/tracker-obsidian-plugin]]"
---

Complete the existing Bases tracker renderer: tree, board and network, with native issue links and subissue progress. The model and tree/network implementations already exist; do not replace them with another task model or ItemViews.

Edit contract: `extensions/obsidian-tracker/{view,main,graph,model}.ts`, `styles.css`, and committed first-use fixtures/setup documentation in that directory. `model.ts` stays pure over `{path, frontmatter}`; existing `Issue` and `Model` exports and frontier/mine/done semantics are the shared interface. Keep Bases type `tracker`, existing mode values (network is `graph`), and persisted keys `toggled`, `pinned`, `showDone`, `includeDeferred`; add `board` without renaming existing settings. The rollout sibling owns installation and migration of the live vault.

Bases owns grouping, filtering and sorting. Render board columns from its grouped entries rather than introducing hard-coded workflow groupings; the earlier project-planner attempt was rejected for those. Reuse the existing row/link/metadata presentation as cards. No stage-changing drag/drop is required. Compute readiness and progress from all issue metadata, then intersect with Base entries for display; a filtered-out child must still affect its parent's rollup. Show subissue completion/progress alongside own and subtree stage without deriving new lifecycle states.

Precedent: `TrackerView.onDataUpdated` already separates the vault model from visible Base groups; `row`, `link`, `fileMenu` and `drawGraph` hold interactions. `Graph` retains positions across updates, persists drag pins and labels isolated nodes on hover. Preserve those behaviors. Repair space-separated `cls` arguments using arrays (the parent records that Obsidian throws for strings containing spaces). Network nodes currently use SVG groups with callbacks, whereas rows have internal-link anchors: carry the native copy/hover/open-in-pane contract across all three surfaces, not just click-to-open.

First use: commit a reproducible disposable Obsidian vault setup with the built plugin and a `.base` containing tree, board and graph views; seed a parent with open/done children, an external dependency, and an isolated issue under `projects/<name>/issues/`. Use local desktop Obsidian (manifest minimum 1.10.0, Bases enabled), no credentials. Build with `bun run extensions/obsidian-tracker/build.ts`; do not repoint the existing live plugin symlink to a disposable worktree. Open the fixture Base yourself and hand off the exact command/URI and owned vault identity. Reuse existing setup tooling if available rather than inventing a harness.

Done: switching views and navigating away/back preserves collapse and pin state; all three surfaces open, hover and expose native link/file operations; filtering/grouping/sorting work and do not truncate rollups; subissue progress is visible. Existing frontier/mine/done/invalid/legacy/all views still work. Try these in Obsidian; driver/reviewer own systematic and rendered acceptance, not new permanent tests here.

Existing checks: `ab check -- bun test lib/tracker-views.test.ts`; plugin build; plugin TypeScript config via the repository's installed TypeScript. Install plugin dependencies with its committed Bun lock if needed. The parity suite accepts `TRACKER_VAULT` and optional `TRACKER_PROJECT`; see `lib/tracker-views.test.ts`. Run CLI parity against a matching project/vault identity, not a worktree basename absent from the vault. Read the tracker lifecycle reference before any model change.

## Result

[First-use driver evidence](../attachments/tracker-obsidian-views/index.md). Rendering, grouping, progress, collapse and pin persistence observed; native menu/preview/split operations and complete legacy-mode membership await reviewer verification.
