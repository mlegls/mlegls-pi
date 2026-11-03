---
stage: "ticket"
assignee: "agent"
author: "session:review-3"
priority: 4
---
Two frames of one canvas page whose names differ only in non-ASCII characters get the same standalone file. Seen on Concept's screens canvas page "Contain a waiting or failed request" (2026-11-03): "Settings — Plan & credit failed — 1440" and "Settings — Plan & credit failed, 简体中文 — 1440" both write `frame-…--settings-plan-credit-failed-1440.html`; the later overwrites the earlier, so the English frame's ↗ "Open alone in a new tab" opens the Chinese one. The canvas itself shows both frames correctly.

Cause: `slug` in [canvas.ts](../../skills/enabled/all/mlegls/artboard/scripts/canvas.ts) replaces every run of non-`[a-z0-9]` with "-", so "failed, 简体中文 — 1440" and "failed — 1440" slug to the same text, and `key = pageKey + "--" + slug(frame.name)` (the `for (const frame of page.frames)` loop) is not checked for duplicates.

## shape

Make frame keys unique within a page: when `key` was already used, append "-2", "-3"… (or the frame's index), so the file and its ↗ link stay stable for a layout that does not change. Rebuild a layout with two frames named "A" and "A 简体中文" and check both standalone pages show their own frame.

Found by an independent drive of Concept's [draw-contained-read-failures-and-long-waits] (moved from Concept's `screens-canvas-review-links-collide-for-chinese-frame`; its other observation, a full canvas build failing with ERR_CONNECTION_REFUSED because other pages of Concept's `docs/design/screens.json` name `"storybook": "http://127.0.0.1:6009"`, is Concept's layout, not this tool).
