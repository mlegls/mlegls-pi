# Live tracker rollout first use

Implementation first use, not a systematic acceptance pass. Tested renderer inherited at `39bb425`, deployment changes at `af54949`; final deployment adds an asset-presence preflight. Desktop Obsidian 1.13.7, English/dark, 1024×800 CSS px (2048×1600 screenshots). Actual user's vault `/Users/mlegls/obsidian`, no auth/secrets, existing project issues, no fixture or seeded notes.

## Setup

Confirmed the registered vault path/name and the live plugin symlink to `/Users/mlegls/dev/mlegls-pi/extensions/obsidian-tracker/dist`. Directly opened `obsidian://open?vault=obsidian&file=projects%2FTracker.base` with `open`. The shared app's CLI socket was absent; native recovery did not restore it. Closed its live window before starting an owned Obsidian instance over **the same live vault**, with separate HOME/profile and port 9239. Its CLI confirmed `app.vault.getName() = obsidian`, adapter path `/Users/mlegls/obsidian`, and only Tracker/Excalidraw/Tasks/Outliner loaded.

Reproduce with [LIVE.md](../../../extensions/obsidian-tracker/LIVE.md): build, `live-setup.ts prepare "$PWD"`, open the URI and reload the plugin. The documented separate-HOME recipe is the fallback used here; no ignored state is needed. Stable dist contains copied built artifacts, not a worktree symlink. The canonical checkout must rebuild it after integration.

## Git changes versus external state

Git: repeatable migration/deployment and rollback recipe; guarded refresh of an already-migrated Base; workspace redirects; this encounter and friction records. Renderer unchanged. No Git-tracked files deleted and no new tests.

Inherited external migration backup: `~/obsidian/.obsidian/tracker-rollout-2026-09-30T05-09-24-910Z/`. Before this worker began, the Base already had Board and Datacore was already disabled. That backup retains the previous Base/plugin list/dist. This worker did not infer permission to reapply the old state.

External preparation at `~/obsidian/.obsidian/tracker-rollout-2026-09-30T11-58-57-150Z/` backed up Base, plugin list, workspace and stable dist. Repeated preparation preserved the existing Board/plugin list and copied current build assets. `.obsidian/workspace.json`'s four stale sidebar `tracker/Tracker.md` / `tracker/Tracker.base` references were redirected to `projects/Tracker.base`. Obsidian subsequently saved workspace and serialized the Base during interactions. Temporary search, collapse and pin changes were cleared. Comparing parsed YAML with the original 05:09 backup, excluding the appended Board, returned **all original Base values preserved: true**: filters, formulas, properties, sort/group options, ten saved collapse paths and empty pins.

Repeated setup then immediate rollback succeeded with `~/obsidian/.obsidian/tracker-rollout-2026-09-30T12-11-34-615Z/`, restoring the already-migrated target, not undoing the original rollout. Backups remain intentionally external to Git.

Vault-wide, hidden/follow-symlink searches located no `Tracker.md`, `Graph.md`, `lib.md`, relocated Datacore render blocks, `dc.require` consumers or incoming Markdown navigation to those notes. Remaining textual Datacore/old-path mentions were ticket/research/history prose in project notes, not renders or navigation. No notes were deleted here. Datacore is absent from the enabled-plugin list and from runtime plugins; its disabled installed package remains available for rollback. Unrelated notes/plugins were untouched.

## First-use observations

- **Tree/Board/Network rendered:** [Tree](01-live-tree.png), [Board](02-live-board.png), [Network](03-live-network.png). Saved Board groups by `formula.project`, sorted ascending priority. Tree/Board initially used 1,180 Base entries; Network selected 471 nodes/81 edges. Other workers changed the live issue set during this run, so these are encounter counts, not a frozen fixture.
- **Navigation and full-vault rollups:** Board search for `agentic-setup-reorg` showed one card with `15/17 subissues`, while children were absent ([filtered rollup](04-live-filtered-rollup.png)). Clicking the card opened `projects/mlegls-pi/issues/agentic-setup-reorg.md`; reopening the Base restored working Tree/Network. Cleared the temporary search. Saved collapse state survived view/note changes ([Tree return](06-live-tree-return.png)); final YAML comparison retained all ten original paths.
- **Pins:** Electron pointer events dragged `tracker-obsidian-rollout`, saving `[1665,1129]`. Reopening Base retained it ([pin state](05-live-pin-return.png)). A subsequent Graph-link click opened `projects/mlegls-pi/issues/tracker-obsidian-rollout.md`; after returning and selecting Graph, its DOM transform was exactly `translate(1665,1129)`. The screenshot precedes this last round trip; the DOM observation establishes the post-return position. Double-click unpinned, restoring original `{}`. Narrowing the graph can leave a full-vault pin outside its new viewBox: [filed](../../issues/tracker-network-pin-outside-filtered-viewbox.md).
- **Legacy modes available, exact parity fails:** selected Frontier, Mine and Done after waiting for actual rows. Mine displayed human-owned issues; Done rendered 288 issue links in the later live state. Frontier incorrectly included `tracker-obsidian-plugin` and the inflight `tracker-obsidian-rollout` compared with CLI snapshot. CLI reports both `ready: true, frontier: false` because it derives the rollout worker/branch claim. The pure renderer receives no runtime claim. [Acceptance conflict](../../issues/tracker-parity-compares-derived-claims-with-frontmatter-only.md). No membership gate was weakened; this ticket is not done.

View selection used the Base controller's saved-view selection through vault-scoped Obsidian CLI; link/collapse actions used rendered elements and Graph drag used Electron input events. An immediate read can show the previous renderer after the toolbar has changed; later observations waited for the intended surface. Native menus/hover/split were not re-audited here.

## Validation and cleanup

- `ab check -- bun run extensions/obsidian-tracker/build.ts`: passed.
- `ab check -- ./node_modules/.bin/tsc -p extensions/obsidian-tracker/tsconfig.json`: passed after locked plugin dependencies were installed and deployment-script diagnostics were repaired.
- `TRACKER_VAULT=$HOME/obsidian TRACKER_PROJECT=$HOME/dev/mlegls-pi ab check -- bun test lib/tracker-views.test.ts`: twice **4 pass / 1 fail**, at line 99 for `tracker-obsidian-plugin` (view true, CLI false). Concrete acceptance blocker, not waived by its existing idea.
- `ab check -- bun test`: **331 pass / 3 skip / 16 fail / 16 errors**; [optional DSH setup/discovery](../../issues/root-bun-test-selects-unprepared-optional-dsh.md) links the existing owners for other errors. No unrelated tests deleted.
- Repeat prepare/rollback on the closed live target: passed; final original Base values preserved and no stale tracker workspace refs remained.

Stopped both owned `ab` services (`3e638a55-0f8f-4508-9312-d41f030b285a`, `381aa540-ba0c-4e47-9758-3826bb86209a`) and the named `tracker-obsidian-rollout` browser bridge. No owned process remains. The shared application was not killed; its live window was closed to avoid two writers. The owned profile was under this worktree's `.wm/` and is disposable. [Native/CLI friction](../../issues/computer-obsidian-vault-chooser-native-drive.md); [socket owner](../../issues/obsidian-cli-socket-taken-by-parallel-instance.md).

## Late-delivered ownership restriction

After this replacement worker's implementation report, an owner message was delivered prohibiting re-running preparation and marking the user's live Obsidian window read-only. Earlier actions described above had already repeated preparation, interacted with Settings in the shared window and closed it, then exercised the live vault in an owned instance. Those actions do not comply with the newly delivered restriction; no further live-vault or GUI changes were made after its receipt. Screenshots had also already been inspected before the instruction to keep them out of context arrived.

Owner disposition is needed for the external changes and shared-window closure. The initial migration remains installed; the original Base values, excluding the added Board, were restored and compared equal. The 11:58 backup records the workspace/dist state before this worker's refresh; the 12:11 repeat/rollback restored the already-migrated target. Do not perform another rollback or reopen the shared window on this worker's authority.
