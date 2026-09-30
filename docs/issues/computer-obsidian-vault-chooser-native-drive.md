---
stage: idea
author: session:01a0f091-86ac-707b-bf11-1aa6cacae98c
---

During [[projects/mlegls-pi/issues/tracker-obsidian-views]], `ab computer --app Obsidian` chose application-menu `Open Vault…`; Cua refused `element_outside_target_window` for window 160 (PID 29446). Opening the chooser through `obsidian eval 'code=app.openVaultChooser()'` and starting a fresh native drive then failed before any action with `Decision API: HTTP 400: max_tokens_exceeded`.

Traces: `2026-09-30043037-e52b0a.jsonl` and `2026-09-30043056-38d93e.jsonl` under the originating session's `.ab/computer/`. Owner: mlegls-pi computer native adapter / Cua and Jev request sizing. Neither failure established anything about the tracker plugin.

Workaround: Obsidian's existing desktop CLI, scoped by disposable vault name. The chooser's own `vault-open` IPC registers the fixture folder; CLI eval and Electron input events exercised the rendered Base without modifying the live vault.
