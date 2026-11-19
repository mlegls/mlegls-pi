#!/usr/bin/env bash
# Run from the mlegls-pi checkout root. Repair one historical citation in a disposable Common Concept vault.
set -euo pipefail
tracker="$PWD/skills/enabled/all/mlegls/conventions/tracker/scripts/issues.ts"
scratch=$(mktemp -d)
trap 'rm -rf "$scratch"' EXIT

git clone -q --shared --no-checkout "$HOME/dev/mmon/concept" "$scratch/concept"
git -C "$scratch/concept" config user.name 'Tracker fixture'
git -C "$scratch/concept" config user.email 'tracker-fixture@example.invalid'
git -C "$scratch/concept" checkout -q --detach 73dabc569416a5b6add49110440c1bd33d4be279
git -C "$scratch/concept" worktree add -q --detach "$scratch/worker"
cd "$scratch/worker"

locator=issues/attachments/browser-replay-rulings/study.md
(bun "$tracker" check || :) | grep -F "$locator:"
bun "$tracker" text "$locator" | grep -F 'study-fixtures.ts'
bun "$tracker" text "$locator" |
  bun -e 'const note = await Bun.stdin.text(); process.stdout.write(note.replace("../../../../packages/web/test/harness/study-fixtures.ts", "https://github.com/mlegls/mmon-co/blob/6fbd235e9882329aaef9a18c9bcc20512a7fe3dd/packages/web/test/harness/study-fixtures.ts"));' |
  bun "$tracker" update "$locator" --body-file -

# Other findings in the historical checkout are outside this repair.
(bun "$tracker" check || :) | grep -Fc "$locator:" || :
git -C "$scratch/concept" show --stat --oneline HEAD
git status --short
