#!/usr/bin/env bash
set -eu
ROOT=$(git rev-parse --show-toplevel)
STATE="$ROOT/.wm/tracker-scoped-drive"
mkdir -p "$STATE/home/obsidian/projects" "$STATE/scoped-drive/docs/issues/archive"
ln -s "$STATE/scoped-drive/docs" "$STATE/home/obsidian/projects/scoped-drive"
cd "$STATE/scoped-drive"
git init -q
git config user.email drive@example.invalid
git config user.name 'Tracker drive'
for slug in move-a move-b older; do
  printf '%s\n' '---' 'stage: done' 'author: user:drive' '---' '' 'Archived result.' > "docs/issues/$slug.md"
done
mv docs/issues/older.md docs/issues/archive/older.md
cat > docs/issues/mixed.md <<'ISSUE'
---
stage: ticket
assignee: agent
author: user:drive
---

Selected A: [[projects/scoped-drive/issues/move-a]].
Selected alias: [[projects/scoped-drive/issues/move-a|A]].
Selected B: [[projects/scoped-drive/issues/move-b]].
Old unrelated: [[projects/scoped-drive/issues/older]].
ISSUE
cat > docs/issues/other-session.md <<'ISSUE'
---
stage: ticket
assignee: agent
author: user:drive
---

Old unrelated: [[projects/scoped-drive/issues/older]].
ISSUE
git add .
git commit -qm 'Seed tracker before this archive change'
mv docs/issues/move-a.md docs/issues/archive/move-a.md
mv docs/issues/move-b.md docs/issues/archive/move-b.md
printf '\nAnother user is still writing this paragraph.\n' >> docs/issues/mixed.md
printf '\nAnother session owns this dirty file.\n' >> docs/issues/other-session.md
printf '%s\n' "$STATE"
