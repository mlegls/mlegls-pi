# Live tracker rollout

Target: the registered desktop Obsidian vault `~/obsidian` (vault name `obsidian`), using issue notes in `projects/*/issues/` mounted from project checkouts. No account or secrets. The `tracker` plugin symlink must point to `~/dev/mlegls-pi/extensions/obsidian-tracker/dist`; never point it at a worktree. This recipe does not replace the Base or prune notes. Close any other writers to the live Base before applying; Obsidian may save its open Base after external edits.

From the checkout being deployed, after confirming the live vault and symlink belong to you:

```sh
ab check -- bun run extensions/obsidian-tracker/build.ts
bun extensions/obsidian-tracker/live-setup.ts prepare "$PWD"
open 'obsidian://open?vault=obsidian&file=projects%2FTracker.base'
```

The script refuses an unregistered vault, unexpected symlink, already-migrated Base, changed plugin list, or any remaining fenced Datacore render consumers under the vault (following project symlinks). Inspect moved legacy tracker notes and incoming links before executing; do not delete unrelated content. It backs up the Base, enabled-plugin list and old dist files to `.obsidian/tracker-rollout-<timestamp>/`, prints the rollback command, appends a Board grouped by `formula.project` and sorted by priority, disables Datacore and installs built artifacts into the stable canonical dist. Existing filters, formulas, saved view options, collapse paths and pins remain textually unchanged. Restart/reload the vault plugin if it was already loaded; URI reopening alone need not reload running JavaScript. After integration, run the build from the canonical checkout to replace the same stable dist, not from a retired worktree.

To rollback, close the vault, run the printed `bun extensions/obsidian-tracker/live-setup.ts rollback /absolute/backup-directory` from this checkout, then reopen the URI. Rollback refuses to overwrite any file changed since setup; save subsequent edits separately before restoring. The backup is outside Git and intentionally remains until no longer needed. A running Obsidian may rewrite `.obsidian/workspace.json`: stale former `tracker/Tracker.md` and `tracker/Tracker.base` pane references are UI history, not notes; reopen the live Base and adjust these panels through the application, not while it is writing the workspace file.

Check from the matching project checkout:

```sh
TRACKER_VAULT="$HOME/obsidian" TRACKER_PROJECT="$HOME/dev/mlegls-pi" ab check -- bun test lib/tracker-views.test.ts
```
