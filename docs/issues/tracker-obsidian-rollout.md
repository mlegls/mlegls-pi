---
stage: ticket
assignee: agent
author: session:01a0f08f-9962-73f5-8231-63e51693973d
part-of: "[[projects/mlegls-pi/issues/tracker-obsidian-plugin]]"
blocked-by:
  - "[[projects/mlegls-pi/issues/tracker-obsidian-views]]"
---

Make the completed tree, board and network views the live tracker and retire the datacorejsx tracker notes and dependency. Depends on the renderer and reproducible fixture setup in [[projects/mlegls-pi/issues/tracker-obsidian-views]]. This child owns live-vault migration and reproducible deployment documentation/scripts under `extensions/obsidian-tracker/`; the renderer sibling owns view code.

Observed 2026-09-30: `~/obsidian/projects/Tracker.base` already uses type `tracker` for tree, graph, frontier, mine, done and invalid. Its tree groups by `formula.project` and contains saved `toggled` paths; graph has `pinned`. `~/obsidian/tracker/` does not exist at that path. `~/obsidian/.obsidian/plugins/tracker` is a symlink to `/Users/mlegls/dev/mlegls-pi/extensions/obsidian-tracker/dist`. Both `tracker` and `datacore` are in `community-plugins.json`. These are observations, not permission to overwrite newer configuration; re-read before applying.

Keep the live Base's filters, formulas, sort/group options, collapse state and pins. Add the missing board view using the renderer's Bases grouping contract. Locate the former `tracker/Tracker.md`, `lib.md`, `Graph.md` and any relocated equivalents/references before retiring them; absence at their old paths is not proof that all datacorejsx consumers are gone. Remove the obsolete tracker renders and update incoming navigation to the live Base. Check other datacore consumers before disabling/removing that plugin; if unrelated consumers prevent retirement, report the concrete conflict rather than deleting unrelated notes or claiming success.

Use the existing build (`bun run extensions/obsidian-tracker/build.ts`) and stable plugin deployment convention; never leave the live vault pointing at a retiring worktree. Commit a repeatable setup/migration recipe, including rollback of changed vault configuration, so integration can build the canonical checkout and the driver can reproduce the target without ignored worktree state. Preserve user content, avoid wholesale Base/config replacement, and record external edits separately from Git changes. Confirm ownership of the live target before changing it; don't merge or push the canonical checkout.

First use is the user's local desktop Obsidian vault `~/obsidian`, no auth or secrets, with its existing project issue notes as state. The surface is `obsidian://open?vault=obsidian&file=projects%2FTracker.base` (confirm the registered vault name before reuse). Open it yourself, exercise all three views, follow an issue link and return, and confirm saved collapse/pins and full-vault rollups survive. Use the sibling's disposable setup for rehearsal if needed, but a fixture alone does not meet the live-tracker destination.

Done: live tree/board/network work; frontier/mine/done retain CLI semantics; obsolete tracker datacorejsx notes and datacore dependency are retired; reproducible startup and actual prepared target are recorded. Run the existing parity suite with `TRACKER_VAULT=$HOME/obsidian` and `TRACKER_PROJECT=$HOME/dev/mlegls-pi` through `ab check`, plus the plugin build. Report the directly opened entry URI, external changed files and any resource cleanup. Driver/reviewer own systematic acceptance; no new permanent tests.
