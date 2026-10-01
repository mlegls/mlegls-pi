#!/usr/bin/env bash
# Make a new, disposable vault. Never overwrite a vault or change the live plugin symlink.
set -euo pipefail
here=$(cd "$(dirname "$0")" && pwd)
target=${1:?usage: first-use.sh /absolute/path/to/new-vault}
[[ "$target" = /* && ! -e "$target" ]] || { echo 'Target must be an absolute, nonexistent path' >&2; exit 1; }
(cd "$here" && bun install --frozen-lockfile)
bun run "$here/build.ts"
mkdir -p "$target/.obsidian/plugins/tracker"
cp -R "$here/fixture/." "$target/"
cp "$here/dist/"{main.js,manifest.json,styles.css} "$target/.obsidian/plugins/tracker/"
printf '%s\n' '["file-explorer","page-preview","bases"]' > "$target/.obsidian/core-plugins.json"
printf '%s\n' '["tracker"]' > "$target/.obsidian/community-plugins.json"
printf '%s\n' '{"restrictedMode":false}' > "$target/.obsidian/app.json"
uri=$(bun -e 'console.log("obsidian://open?path="+encodeURIComponent(process.argv[1]+"/Tracker.base"))' "$target")
printf '%s\n' "$uri"
# Obsidian's open URI only addresses registered vaults. Use the desktop CLI's
# vault chooser operation to register this new folder without rewriting app config.
path_json=$(bun -e 'console.log(JSON.stringify(process.argv[1]))' "$target")
obsidian eval "code=require('electron').ipcRenderer.sendSync('vault-open', $path_json, false)"
open "$uri"
