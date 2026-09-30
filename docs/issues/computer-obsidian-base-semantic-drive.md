---
stage: idea
author: session:tracker-obsidian-views-drive
---

During [[projects/mlegls-pi/issues/tracker-obsidian-views]], `ab computer --app Obsidian` found two Obsidian windows, as expected, and required explicit `--window 29446:15390` for the disposable vault. On that exact window the driver repeatedly reobserved (six waits, zero actions), then stopped `stuck` with `Until never verified while waiting`, although a window screenshot showed `Tracker.base` rendering Tree with issue rows. Trace: `2026-09-30044139-0a3175.jsonl` in the originating session's `.ab/computer/`. This did not establish any tracker defect.

Workaround: vault-scoped Obsidian CLI plus native accessibility clicks and screenshots, with explicit waiting for settled Base DOM. Proposed owner: mlegls-pi native computer adapter / Obsidian Cua semantic projection. Investigate why the Base's visible toolbar and rows were not recognized from the scoped native window. Separate from [[computer-obsidian-vault-chooser-native-drive]], which concerned vault chooser and Jev request sizing.
