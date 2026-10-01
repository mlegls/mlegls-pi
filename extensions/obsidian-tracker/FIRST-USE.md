# Disposable first use

Requires desktop Obsidian 1.10+ with Bases (tried on 1.13.7), its `obsidian` CLI enabled, Bun and `ab`. No account or credentials. From the repository root:

```sh
extensions/obsidian-tracker/first-use.sh /tmp/tracker-obsidian-demo
```

Use a new absolute path each time. This installs locked dependencies, builds the plugin, copies it and the committed fixture into a new vault, registers that folder with desktop Obsidian, and opens `Tracker.base`. It never changes the live vault or its plugin symlink. Registration uses the same IPC operation as Obsidian's “Open folder as vault” chooser. If the CLI is unavailable, open the generated folder through that chooser, then open `Tracker.base`.

On the first opening, choose **Trust author and enable plugins**. If the already-open Base says “Unknown view type: tracker”, reload this disposable vault after trusting:

```sh
obsidian vault=tracker-obsidian-demo reload
obsidian vault=tracker-obsidian-demo open path=Tracker.base
```

Tree, Board and Network are saved Base views; Network persists mode `graph`. Board groups on the fixture's arbitrary `lane` property, not lifecycle stages. Its cards sort by descending filename. Filtered board shows only `parent`, still own done / tree ticket, 1/2 subissues complete and one external blocker. Progress counts direct children whose entire subtree is done, including children excluded by Base filters. The remaining views exercise frontier, mine, done, invalid, legacy and all. The isolated network node labels on hover. Command-hover previews notes; right-click offers copy links, open in tab/split/window and file-menu extensions. Drag pins a node; double-click unpins it. Tree collapse and network pins are saved in the Base.

Implementation first use prepared `/tmp/tracker-obsidian-views-clean` from this script (owned disposable vault, copied plugin, no auth). Its trust prompt was accepted and the Base opened on desktop Obsidian 1.13.7:

```sh
open 'obsidian://open?path=%2Ftmp%2Ftracker-obsidian-views-clean%2FTracker.base'
```

Tried switching all ten fixture views, Base grouping and descending sort, filtered parent progress/blockers, collapse across view changes, drag pin across note navigation, double-click unpin without navigation, all three surfaces opening notes and producing file menus, command-hover previews, copying a wikilink and opening a card in a split. The window is closed after use; the URI reopens it. Fresh driver/reviewer owns systematic and rendered acceptance.

Existing checks:

```sh
bun run extensions/obsidian-tracker/build.ts
./node_modules/.bin/tsc -p extensions/obsidian-tracker/tsconfig.json
```

The optional live CLI parity run requires a matching canonical project/vault identity. A runtime-derived claim mismatch is recorded in `docs/issues/tracker-parity-compares-derived-claims-with-frontmatter-only.md`; do not rename the worktree to make a mismatched comparison look meaningful.

On macOS, Obsidian renders context menus natively by default, so they are absent from the DOM that `obsidian eval` sees. To inspect menu items from a script in the disposable vault, first run `obsidian vault=<name> eval code="app.vault.setConfig('nativeMenus', false)"`; the menu contents are the same either way. Page previews appear only when the synthetic pointer coordinates lie over the hovered element (for Network, the node's circle).

Close the disposable vault window when finished. Its copied plugin and fixture can be deleted together; remove its entry from Obsidian's vault chooser if no longer needed. Do not remove or repoint the live vault plugin.
