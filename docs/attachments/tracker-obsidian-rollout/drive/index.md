# Live tracker: independent first-use drive

Revision: `9e7f811c3faa3d34395a000a536f37bcbd734636`. Persona: local desktop vault owner, no authentication. Required target: `/Users/mlegls/obsidian`, existing project issues, plugin deployed to canonical `~/dev/mlegls-pi/extensions/obsidian-tracker/dist`. Recipe: `extensions/obsidian-tracker/LIVE.md`. Entry: `obsidian://open?vault=obsidian&file=projects%2FTracker.base`.

## Predictions, written before opening the product

1. **Live views:** opening the URI will display the live Tracker Base, not a fixture or a chooser. Tree, Board and Network will be selectable and show my existing project issues. Board will group by project. Clicking an issue will open its actual note; returning will restore the Base.
2. **Preservation and rollups:** existing Tree collapse choices and Network pins will still be present. Switching views and returning from a note will keep them. A parent with children will show full-vault completion, not only children visible under the current filter. Existing filter/formula/group/sort settings will remain rather than being replaced by defaults.
3. **Legacy modes:** Frontier will list metadata-ready issues, Mine the assigned/claimed metadata work, and Done completed metadata. The existing parity command in LIVE.md will agree with CLI under the supervisor's frontmatter-only ruling.
4. **Retirement and reproduction:** Datacore will not be enabled; former tracker render notes will no longer be navigation destinations or remaining render consumers. Repeating the committed setup should preserve current Base settings and deploy to a stable canonical path. Its rollback recipe should be runnable without ignored worktree state.

## Session log

- Read the ticket and LIVE.md only, not implementation, tests or fixtures. The handoff says the live migration is already prepared and owned processes are stopped. Peer board confirms earlier live access is finished. I will verify registered target, plugin destination and absence of another live writer before preparation/opening.

- Confirmed registered vault path and canonical symlink; no live vault window was open. Built through `ab check` (092a4194-ce12-4308-b0e9-8bddce6f2b6b), repeated `prepare "$PWD"`, which finished and produced `.obsidian/tracker-rollout-2026-09-30T12-21-45-952Z`. Metadata parity through `ab check` (c3328235-b01f-47d4-906d-7b482ea47040): 5 pass, 0 fail, 1751 assertions; reported 1190 issues, 16 frontier, 20 mine, 288 done, 1 legacy, no invalid.
- Tried LIVE.md's isolated-HOME instance (service 46a80559-e3fc-49d9-97f9-befb5abca97d; PID 78514/window 16443). Passed the exact entry URI as a startup argument; app log confirmed callback receipt. It opened the real live Base but displayed **Unknown view type: tracker** and 0 results. `plugin:reload id=tracker` returned Reloaded but did not fix it. Settings → Community plugins revealed Restricted mode. I did not approve the security prompt. This profile recipe lacks a trust step. Stopped the owned service before switching to the already-trusted regular instance; no simultaneous live writers.
- Opened the exact URI through `cua-driver launch_app` in the regular trusted instance. Newly created exclusive window: PID 29446/window 16473, Obsidian 1.13.7, English, dark theme, 1512×944 native window (PNG 1568×979). Initially reopened Done, showing actual live project issues and 1194 Base results. Selected Tree through its saved-view menu; after render settled, project groups and issue hierarchies appeared, including `payments-service-v1` at **2/7 subissues**, and the pre-saved collapsed `reconcile-story-replays-with-their-encounters` at **3/4 subissues**. The toolbar count is Base membership, not mode count, as documented.
- Selected Board. All four project lanes fit at this width. `agentic-setup-reorg` showed 15/17 subissues. Opened Search, entered `agentic-setup-reorg`: **Showing 1**, only that card remains, still **15/17**. This met the filter-independent rollup expectation without any fixture. The first snapshot after a saved-view switch can still contain the previous renderer's rows: waited by fresh observation before treating the screenshot as settled evidence.
- Clicked the filtered Board issue title: opened the actual `projects/mlegls-pi/issues/agentic-setup-reorg` note with goal/human/priority 1 properties. Navigate back returned to Board. **Unexpected:** Search was cleared/closed, so the return showed all project lanes rather than my one-card search. Saved view selection survived.
- Selected Graph. After settling: **482 nodes · 78 edges**, rendered on the live vault. At full-vault scale the labels are too small to use comfortably. Search `agentic-setup-reorg` reduced it to **1 node · 0 edges**, but its node had no visible title/rollup. Expected to be able to identify the sole search match without hovering: not met.
- Tried to pin that lone node: exact-window Cua background drag from PNG (987,599) to (895,494) refused `background_unavailable`. Reobserved unchanged state. One explicitly scoped foreground drag then reported delivery but the fresh image still showed the node at (987,599), and the Base still had `pinned: {}`. No pin was created. Pin persistence is **unobservable**, not passed; the inherited pin map was empty, so there was no pre-existing saved pin to validate. No direct config/DOM workaround was used.
- Returned Graph→Tree and cleared Search. The inherited `reconcile-story-replays-with-their-encounters` remained collapsed with 3/4 progress. Opened that Tree link to its actual Concept note, then Navigate back; it remained collapsed (13-collapse-after-note.png). Compared the current Base against setup backup `0`: **byte-for-byte unchanged**, including all filters, formulas, grouping, sort, ten toggled paths and empty pins. Enabled-plugin list also byte-for-byte unchanged.
- Read-only vault inspection followed project symlinks: searches for fenced Datacore consumers and `dc.use/query/require` returned no Markdown hits; searches for old tracker note navigation returned only the two rollout/parent ticket descriptions. No Tracker.md or lib.md exists anywhere in the vault. One Graph.md exists at `projects/concept/core/concepts/Graph.md`; its public note defines Patch Nodes/Edges/Metadata, not a tracker render, and was left alone. Datacore is absent from community-plugins.json, Tracker remains enabled. This establishes retirement state, not the provenance of historical deletions.
- Selected Frontier: 15 live rows across project groups, including this rollout and parent plugin ticket. Selected Mine: 22 live rows, including `agentic-setup-reorg` as human work. Done had rendered on initial trusted entry. Re-ran the required metadata parity suite after the journey: **5 pass, 0 fail**, 1751 assertions; now 1194 issues, 15 frontier, 22 mine, 289 done, 1 legacy, no invalid. The live vault changed during this run; the initial counts are not a frozen seed. GUI Frontier/Mine visible counts agree with the final public suite summary. I did not manually enumerate all 289 Done rows.
- Closed only the newly created live window using its red close control; exact-PID `list_windows` returned no on-screen windows. The inherited regular Obsidian process was not stopped. Tried the printed rollback command against my setup backup **after** closing the window. It refused: `Changed since setup, refusing to overwrite .../.obsidian/workspace.json`, as the recipe promises. Did not force restoration. Base and enabled-plugin list still compare identical to backup; stable dist hashes still match setup's manifest. Completed rollback restoration is not observed.
- Service 46a80559-e3fc-49d9-97f9-befb5abca97d is stopped (receipt: done/code 0/reason stopped). Ended only Cua session `rollout-drive`. No browser bridge or server was started.

## Outcomes and expectations

| Story / prediction | Outcome | Evidence and limit |
|---|---|---|
| Live Tree/Board/Network, issue navigation | held; prediction met on regular trusted instance | All three rendered actual issue notes. Board and Tree links opened their real notes and returned. Isolated-profile entry instead opened the Base with Unknown view type. |
| Preserve Base options and collapse, full-vault rollups | held; prediction met | Base remained byte-for-byte identical after preparation and use. Pre-saved collapsed Concept parent survived view and note round trips. Agentic parent retained 15/17 while Search showed only one card. |
| Saved pin persistence | unobservable; prediction not established | Inherited pins were empty; native drag never created one. No claim about saved-pin behavior follows from unchanged empty configuration. |
| Frontier/Mine/Done metadata parity | held; prediction met within documented ruling | Required public command passed twice; Frontier/Mine rendered their final expected counts. Done rendered, with its full membership delegated to the existing suite. Runtime dispatch semantics explicitly excluded by the ticket's ruling. |
| Datacore retirement | held; prediction met | Datacore disabled; no remaining render consumers or incoming old tracker destinations found in live Markdown scan. One unrelated Concept Graph note preserved. Disabled Datacore binaries remain intentionally. |
| Repeatable deployment/startup and rollback | failed for fresh-profile startup; prediction partially met | Build and repeat prepare completed from this worktree into stable canonical dist without ignored setup state. Fresh-HOME recipe omitted plugin trust. Rollback's overwrite guard held; restoration was not exercised. |
| Search context when returning from issue | not met (formed during use) | Board search cleared and closed after note→Base; saved Board view itself survived. |
| Network readable at full-vault and one-match scale | not met (formed during use) | Full graph labels were microscopic; single filtered node had no visible title/rollup. |

## Frictions

- [Fresh owned profile lacks plugin trust](../../../issues/archive/tracker-live-owned-profile-missing-trust-step.md): the documented reload command reports success while the Base remains unknown. Used the already-trusted regular instance, exclusively created window, instead.
- [Native drag did not create a pin](../../../issues/cua-obsidian-network-drag-does-not-pin.md): background refused, foreground delivered-but-unchanged. No workaround; reviewer still needs pin evidence.
- The first frame after switching views can show the new view name over the previous view's rows. Fresh observation after settling avoided treating that frame as final behavior.
- Search resets on note→Base, so returning to the issue's filtered context needs typing the search again.
- Network needs better discoverability at live-vault scale; filtering one node still did not expose its identity in the visible frame.
- Done text is very dim in this dark theme. It renders, but scanning it is harder than Tree's active rows.

## Replayable checks (no tests added)

1. **Regular entry:** hand the exact URI to the registered trusted Obsidian instance with no other live window writer. Accept only a Tracker Base with actual existing issue rows and a live canonical plugin target, not a responding app/chooser. Repeat the fresh-HOME recipe separately; accept a functioning Tracker or an explicit owner trust step, not successful reload text alone.
2. **Board rollup:** choose Board, record `agentic-setup-reorg` progress, open Search and type its exact slug. Accept Showing 1 with the same numerator/denominator (15/17 here), though none of its children are rendered. Open its title; accept its real note properties; Navigate back. Check whether view and search are independently preserved.
3. **Collapse:** in Tree, locate the pre-saved collapsed `reconcile-story-replays-with-their-encounters`. Record closed chevron and 3/4 rollup, select Board→Graph→Tree, then open the parent's note and Navigate back. Accept a closed chevron, hidden child rows and unchanged saved toggled entry after both round trips.
4. **Pins:** Graph→Search `agentic-setup-reorg`. Freshly capture the exact window, drag its sole node (987,599)→(895,494) at the recorded PNG dimensions. Accept a moved node and nonempty saved pin entry before proceeding; then switch away/back and open a note/return. Accept the saved node position after each return. Current run never met the initial moved-node predicate.
5. **Legacy modes:** clear Search before selecting Frontier/Mine/Done. Wait for the renderer to settle; compare rendered membership against CLI with the documented frontmatter-only switch. Do not use the Base toolbar count as mode membership. Repeat the LIVE.md parity command through `ab check`; require 5 pass/0 fail.
6. **Retirement:** follow vault project symlinks when scanning Markdown for actual Datacore fences/imports and incoming old tracker links. Classify namesakes before removing anything. Accept no render consumers, no old tracker navigation destinations and Datacore absent from enabled plugins; preserve unrelated Concept Graph.
7. **Deployment/rollback:** with the live window closed, build and prepare from the committed checkout. Accept stable canonical symlink/dist, unchanged pre-existing Base settings, and backup/rollback command. After the journey, rollback must refuse newer workspace changes without altering other managed files. A separate restored-state rehearsal is still needed to establish completed restoration.

## Selected rendered states

All captures are live macOS Obsidian 1.13.7, English/dark; no mocks or fixtures. Isolated-profile screenshots use 1024×800 native window / 1568×1225 PNG; regular live window uses 1512×944 / 1568×979.

- [01-initial.png](01-initial.png): isolated recipe reaches the live Base but Tracker is unknown.
- [03-restricted-mode.png](03-restricted-mode.png): visible fresh-profile trust gate, not approved.
- [04-live-entry.png](04-live-entry.png): directly opened regular live entry on Done.
- [05-tree.png](05-tree.png): settled Tree and inherited collapsed parent.
- [06-board.png](06-board.png): four project lanes and live parent progress.
- [07-filtered-rollup.png](07-filtered-rollup.png): only one card remains, still 15/17.
- [08-issue-note.png](08-issue-note.png): Board issue opened its real note.
- [09-return-board.png](09-return-board.png): Board restored, search lost.
- [10-network.png](10-network.png): full-vault graph, 482 nodes/78 edges.
- [11-drag-unchanged.png](11-drag-unchanged.png): single node remained unmoved after attempted pin.
- [13-collapse-after-note.png](13-collapse-after-note.png): original collapsed Concept parent survives note round trip.
- [14-frontier.png](14-frontier.png), [15-mine.png](15-mine.png): settled legacy-mode membership surfaces.
- [build.txt](build.txt), [parity-initial.txt](parity-initial.txt), [parity-final.txt](parity-final.txt): durable command output; all checks exited 0.

## External effects and cleanup

- Repeat preparation wrote built `main.js`, `manifest.json`, `styles.css` into `~/dev/mlegls-pi/extensions/obsidian-tracker/dist`; symlink still points there, not this worktree. Base and community-plugins.json remained byte-identical. Managed artifact hashes remained equal to setup's recorded hashes after the refused rollback.
- Obsidian wrote live `.obsidian/workspace.json` during navigation; it was not overwritten on rollback. No issue content was edited; no notes were deleted.
- Backup `.obsidian/tracker-rollout-2026-09-30T12-21-45-952Z` remains intentionally for rollback. Earlier backups and disabled Datacore binaries were not removed.
- Temporary stopped profile `/tmp/tracker-rollout-drive-home.X0efmF` remains; no running process/window belongs to it. Regular live window 16473 is closed. The inherited application process remains as it was before the drive.
- No product repair or permanent test change. Reviewer needs pin persistence and complete rollback restoration evidence, plus the fresh-profile setup repair.

## Review (independent of the driver)

Reviewed head after repairs; driver log above is unchanged.

- **Fresh-profile startup (failed → repaired, re-driven).** Started LIVE.md's scratch-HOME instance on the live vault (Restricted mode on, Tracker enabled but `!!app.plugins.plugins.tracker` false). `HOME=$scratch obsidian vault=obsidian plugins:restrict off` reloaded plugins; Tracker loaded and the live Base opened without "Unknown view type". LIVE.md now includes that step, worded as the owner's trust decision for the scratch profile. Friction archived.
- **Pin persistence (unobservable → held).** In that owned instance, CDP `Input.dispatchMouseEvent` press/10 moves/release dragged `projects/mlegls-pi/issues/tracker-obsidian-rollout`; the node moved and, after Obsidian's debounced save, the Base held `pinned: {<that path>: [700, 1774]}`. Tree→Graph round trip, and note→Navigate back→Graph, left the node at `translate(700,1774)`. A double-click (CDP) unpinned it; the Base is byte-identical to the setup backup `…12-21-45-952Z/0` again. So the drive's cua failure is cua-driver's ([issue](../../../issues/cua-obsidian-network-drag-does-not-pin.md)), not tracker's. Note: while the owned window was occluded, `requestAnimationFrame` stalled and Graph nodes had no transform until `Page.bringToFront`; not a defect in the renderer.
- **Rollback (refusal-only → defect found, repaired, rehearsed).** The driver's refusal was not incidental: `rollback` hashed `workspace.json` and the plugin build files, which Obsidian rewrites on every close and integration rebuilds, so a real rollback would nearly always refuse. It now restores only files `prepare` changed; refuses (before writing anything) only if the Base or enabled-plugin list changed since; leaves changed `workspace.json`/artifacts with a note. Rehearsed in a throwaway `HOME` (fake vault with an unmigrated Base, datacore enabled, stale workspace ref): prepare → workspace rewritten by "Obsidian" → rollback restored Base (board removed), plugin list (datacore back), old artifacts, kept workspace; Base edited after setup → refused, nothing written; re-prepare on a migrated target → rollback restored nothing. Live vault was not rolled back.
- **Checks on final head.** Build passed; `TRACKER_VAULT=$HOME/obsidian TRACKER_PROJECT=$HOME/dev/mlegls-pi ab check -- bun test lib/tracker-views.test.ts`: 5 pass, 0 fail, 1751 assertions (1194 issues, 15 frontier, 22 mine, 289 done). `tsc` for the plugin needs its own locked dependencies, which this worktree lacks; no diagnostics come from `live-setup.ts`.
- **Left as evidence, no new tests.** Ticket says no permanent tests; every check above is a live/first-use or deployment-script replay.
- **Other frictions.** Filed: [search lost on note return](../../../issues/tracker-obsidian-search-lost-on-note-return.md), [network legibility at vault scale](../../../issues/tracker-network-legibility-at-vault-scale.md); dim Done rows already sit in [tracker-obsidian-row-legibility](../../../issues/tracker-obsidian-row-legibility.md).
- **Cleanup.** Owned instance stopped (`ab service stop`), scratch and rehearsal HOMEs and the driver's stopped temp profile removed. Regular Obsidian process untouched. The live Base and plugin list are unchanged by the review; Obsidian may have updated `workspace.json`.
