#!/usr/bin/env bash
set -eu
# Run from the checkout root. Creates only a fresh disposable fixture.
ROOT=$(pwd)
STATE="$ROOT/.wm/tracker-inline-drive"
if [ -e "$STATE" ]; then echo "Fixture already exists: $STATE" >&2; exit 1; fi
mkdir -p "$STATE/home/obsidian/projects" "$STATE/tracker-inline-drive/docs/issues/archive" "$STATE/tracker-inline-drive/docs/attachments"
ln -s "$STATE/tracker-inline-drive/docs" "$STATE/home/obsidian/projects/tracker-inline-drive"
cd "$STATE/tracker-inline-drive"
git init -q
git config user.name 'Tracker drive'
git config user.email 'tracker-drive@example.invalid'
cat > docs/issues/live.md <<'DOC'
---
stage: idea
author: session:tracker-inline-drive
---
A live issue.
DOC
cat > docs/issues/archive/moved.md <<'DOC'
---
stage: done
author: session:tracker-inline-drive
---
Archived target.
DOC
cat > docs/attachments/examples.md <<'DOC'
# Link examples

Valid live link: [[projects/tracker-inline-drive/issues/live]].

Inline: `[[projects/tracker-inline-drive/issues/missing-single]]`.
Double-backtick: ``a ` marker [[projects/tracker-inline-drive/issues/missing-double]]``.
Inline short copied link: `[[parent]]`.

```markdown
[[projects/tracker-inline-drive/issues/missing-backtick-fence]]
```

~~~markdown
[[projects/tracker-inline-drive/issues/missing-tilde-fence]]
~~~

   ```text
   [[projects/tracker-inline-drive/issues/missing-indented-fence]]
   ```

Archive example: `[[projects/tracker-inline-drive/issues/moved]]`.
DOC
git add .
git commit -qm 'Seed disposable tracker drive'
printf 'target=%s\nhome=%s\ncli=%s\n' "$PWD" "$STATE/home" "$ROOT/skills/enabled/all/mlegls/conventions/tracker/scripts/issues.ts"
