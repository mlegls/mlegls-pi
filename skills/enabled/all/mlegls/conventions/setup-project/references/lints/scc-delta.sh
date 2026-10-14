#!/usr/bin/env bash
# Code and complexity totals of the working tree against a git ref, by scc.
#
#   scc-delta.sh [ref=HEAD] [path...]
#
# `simplify` gates on both totals going down; `implement` reports them and
# records a friction when the change grew more than its behavior warranted.
# Totals resist the extract-a-helper move that per-function limits invite.
set -euo pipefail
ref=${1:-HEAD}; shift || true
paths=("$@"); [ ${#paths[@]} -eq 0 ] && paths=(.)
root=$(git rev-parse --show-toplevel)
tmp=$(mktemp -d)
trap 'git -C "$root" worktree remove --force "$tmp" >/dev/null 2>&1 || true' EXIT
git -C "$root" worktree add --detach "$tmp" "$ref" >/dev/null 2>&1

totals() {
  # Ask each checkout's Git, not scc's directory walker: nested ignored
  # dependencies must not inflate the installed checkout against a clean ref.
  local file files=()
  while IFS= read -r -d '' file; do
    # Tracked files may have been deleted locally; never pass directories.
    [ -f "$file" ] && files+=("./$file")
  done < <(git ls-files -co --exclude-standard -z -- "$@")
  if [ ${#files[@]} -eq 0 ]; then
    printf '%s\n' '{"code":0,"complexity":0}'
    return
  fi
  scc --no-cocomo --no-size --format json "${files[@]}" 2>/dev/null \
    | jq -r 'map(select(.Name != "Markdown" and .Name != "JSON" and .Name != "YAML")) | {code: (map(.Code) | add // 0), complexity: (map(.Complexity) | add // 0)}'
}
rel=$(git rev-parse --show-prefix)
before=$(cd "$tmp/$rel" && totals "${paths[@]}")
after=$(totals "${paths[@]}")
jq -n --argjson b "$before" --argjson a "$after" -r '
  "code       \($b.code) → \($a.code)  (\($a.code - $b.code))",
  "complexity \($b.complexity) → \($a.complexity)  (\($a.complexity - $b.complexity))"'
