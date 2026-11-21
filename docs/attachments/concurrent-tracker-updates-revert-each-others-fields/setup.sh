#!/usr/bin/env bash
set -euo pipefail

cli=$(realpath "$(dirname "$0")/../../../skills/enabled/all/mlegls/conventions/tracker/scripts/issues.ts")
scratch=$(mktemp -d)
trap 'rm -rf "$scratch"' EXIT
mkdir -p "$scratch/main/docs/issues"
git -C "$scratch/main" -c init.templateDir= init -q
git -C "$scratch/main" config user.name 'Tracker demo'
git -C "$scratch/main" config user.email 'tracker-demo@example.invalid'
git -C "$scratch/main" commit -q --allow-empty -m 'Initialize tracker demo'
(
  cd "$scratch/main"
  printf '%s\n' 'Original contract.' | bun "$cli" create handoff \
    --fields '{"stage":"ticket","assignee":"agent","priority":2,"author":"session:tracker-demo"}' --body-file - >&2
  git worktree add -qb triage "$scratch/triage"
)
trap - EXIT
printf '%s\n' "$scratch"
