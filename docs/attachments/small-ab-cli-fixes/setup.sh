#!/usr/bin/env bash
# Fresh disposable tracker/anchor seed. Run from the checkout root after bun run setup.
set -eu
ROOT=$(git rev-parse --show-toplevel)
STATE="$ROOT/.wm/tracker-scoped-drive"
ANCHORS="$ROOT/.wm/joined-state"
if [ -e "$STATE" ]; then echo "Disposable fixture already exists: $STATE" >&2; exit 1; fi
bash "$ROOT/docs/attachments/tracker-check-fix-rewrites-other-sessions-dirty-files/setup.sh"
TARGET="$STATE/scoped-drive"
cat >> "$TARGET/docs/issues/mixed.md" <<'DOC'

Inline: `[[projects/scoped-drive/issues/move-a]]`.
Double: ``a ` marker [[projects/scoped-drive/issues/missing-double]]``.

```markdown
[[projects/scoped-drive/issues/move-a]]
[[projects/scoped-drive/issues/missing-fence]]
```
DOC
cat > "$TARGET/docs/issues/other-session.md" <<'DOC'
---
stage: ticket
assignee: agent
blocked-by: ["[[projects/scoped-drive/issues/older]]"]
author: user:drive
---

Old unrelated: [[projects/scoped-drive/issues/older]].

Another session owns this dirty file.
DOC
mkdir -p "$ANCHORS"
AB_STATE="$ANCHORS/ab" AB_SESSION_STATE="$ANCHORS/session" bun "$ROOT/ab/main.ts" read "$TARGET/docs/issues/mixed.md"
printf '\nSeed ready: target=%s\nhome=%s\nAB_STATE=%s/ab\nAB_SESSION_STATE=%s/session\n' "$TARGET" "$STATE/home" "$ANCHORS" "$ANCHORS"
