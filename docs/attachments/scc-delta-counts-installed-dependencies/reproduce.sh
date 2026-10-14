#!/usr/bin/env bash
# Isolated historical first use; removes its owned checkout on exit.
set -euo pipefail
root=$(git rev-parse --show-toplevel)
helper="$root/skills/enabled/all/mlegls/conventions/setup-project/references/lints/scc-delta.sh"
tracker=skills/enabled/all/mlegls/conventions/tracker/scripts
tmp=$(mktemp -d)
trap 'git -C "$root" worktree remove --force "$tmp" >/dev/null 2>&1 || true' EXIT
git worktree add --detach "$tmp" 8b48b29f >/dev/null
cd "$tmp"
bun install --cwd lib/outline-read --frozen-lockfile
bun install --cwd "$tracker"
printf '\nDirectory selection, with nested dependencies installed:\n'
bash "$helper" a5bb3a3 lib "$tracker"
printf '\nThe three changed files:\n'
bash "$helper" a5bb3a3 lib/tracker-views.test.ts "$tracker/issues.test.ts" "$tracker/issues.ts"
printf '\nNested ignored dependency roots:\n'
git ls-files -oi --exclude-standard -- lib "$tracker" \
  | awk '{sub(/node_modules.*/, "node_modules"); counts[$0]++} END {for (path in counts) print counts[path], path}' | sort
printf '\nUnfiltered directory-walk totals (original helper behavior):\n'
scc --no-cocomo --no-size --format json lib "$tracker" \
  | jq 'map(select(.Name != "Markdown" and .Name != "JSON" and .Name != "YAML")) | {code: (map(.Code) | add), complexity: (map(.Complexity) | add)}'
