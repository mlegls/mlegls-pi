# Live tracker rollout

Target: the registered desktop Obsidian vault `~/obsidian` (vault name `obsidian`), using issue notes in `projects/*/issues/` mounted from project checkouts. No account or secrets. The `tracker` plugin symlink must point to `~/dev/mlegls-pi/extensions/obsidian-tracker/dist`; never point it at a worktree. This recipe does not replace the Base or prune notes. Close any other writers to the live Base before applying; Obsidian may save its open Base after external edits.

From the checkout being deployed, after confirming the live vault and symlink belong to you:

```sh
ab check -- bun run extensions/obsidian-tracker/build.ts
bun extensions/obsidian-tracker/live-setup.ts prepare "$PWD"
open 'obsidian://open?vault=obsidian&file=projects%2FTracker.base'
```

The script refuses an unregistered vault, unexpected symlink, conflicting Board, disabled Tracker, or remaining Datacore render consumers under the vault (following project symlinks). Inspect moved legacy tracker notes and incoming links before executing; do not delete unrelated content. It backs up the Base, enabled-plugin list, workspace and old dist files to `.obsidian/tracker-rollout-<timestamp>/`, prints the rollback command, appends a Board grouped by `formula.project` and sorted by priority only when missing, disables Datacore and installs built artifacts into the stable canonical dist. Repeating preparation preserves the existing Board and plugin list. Stale workspace references to former Tracker/Graph notes are redirected to `projects/Tracker.base`; other workspace bytes are unchanged. Existing filters, formulas, saved view options, collapse paths and pins remain textually unchanged. Restart/reload the vault plugin if it was already loaded; URI reopening alone need not reload running JavaScript. After integration, run the build from the canonical checkout to replace the same stable dist, not from a retired worktree.

To rollback, close the vault, run the printed `bun extensions/obsidian-tracker/live-setup.ts rollback /absolute/backup-directory` from this checkout, then reopen the URI. Rollback refuses to overwrite any file changed since setup; save subsequent edits separately before restoring. The backup is outside Git and intentionally remains until no longer needed. Earlier rollout backups without a workspace snapshot are also supported. Close the vault window before applying or rolling back: Obsidian owns workspace writes while running.

Check from the matching project checkout:

```sh
TRACKER_VAULT="$HOME/obsidian" TRACKER_PROJECT="$HOME/dev/mlegls-pi" ab check -- bun test lib/tracker-views.test.ts
```

## Owned desktop instance when the shared CLI is unavailable

Close the live vault window first; never have two writers to its Base/workspace. A separate profile alone is insufficient: Obsidian's CLI socket is under `HOME` ([friction](../../docs/issues/obsidian-cli-socket-taken-by-parallel-instance.md)). These commands open the **real live vault**, not a fixture, without replacing its configuration:

```sh
scratch=$(mktemp -d /tmp/tracker-live-home.XXXXXX)
mkdir -p "$scratch/profile"
LIVE_VAULT="$HOME/obsidian" bun -e 'await Bun.write(process.argv[1], JSON.stringify({vaults:{live:{path:process.env.LIVE_VAULT,open:true,ts:Date.now()}},cli:true}))' "$scratch/profile/obsidian.json"
ab service start -- env HOME="$scratch" /Applications/Obsidian.app/Contents/MacOS/Obsidian --user-data-dir="$scratch/profile"
# After startup, using the returned service ID for cleanup:
HOME="$scratch" obsidian vault=obsidian plugin:reload id=tracker
HOME="$scratch" obsidian vault=obsidian open path=projects/Tracker.base
# Stop the owned instance after first use:
ab service stop <returned-service-id>
```

The regular registered-vault entry remains `obsidian://open?vault=obsidian&file=projects%2FTracker.base`. Run `live-setup.ts` under the real HOME, not this temporary HOME. Select the saved tree, board and graph views, open an issue and return. Do not compare the toolbar's Base result count with Frontier/Mine/Done membership: those modes select within the renderer. Parity is metadata parity: Obsidian remains a pure frontmatter read surface, while runtime/inflight claims belong to CLI dispatch. The suite uses the existing `TRACKER_NO_INFLIGHT=1` CLI switch for snapshot/frontier/mine/done ([resolved ruling](../../docs/issues/archive/tracker-parity-compares-derived-claims-with-frontmatter-only.md)); it does not disable recorded frontmatter claims or change the renderer.
