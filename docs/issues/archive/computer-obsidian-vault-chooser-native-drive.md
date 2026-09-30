---
stage: done
author: session:01a0f091-86ac-707b-bf11-1aa6cacae98c
---

During [[projects/mlegls-pi/issues/archive/tracker-obsidian-views]], `ab computer --app Obsidian` chose application-menu `Open Vault…`; Cua refused `element_outside_target_window` for window 160 (PID 29446). Opening the chooser through `obsidian eval 'code=app.openVaultChooser()'` and starting a fresh native drive then failed before any action with `Decision API: HTTP 400: max_tokens_exceeded`.

Traces: `2026-09-30043037-e52b0a.jsonl` and `2026-09-30043056-38d93e.jsonl` under the originating session's `.ab/computer/`. Owner: mlegls-pi computer native adapter / Cua and Jev request sizing. Neither failure established anything about the tracker plugin.

2026-09-30 rollout also hit `max_tokens_exceeded` at step 0 while asking `ab computer --window 29446:160` to restore the live vault's CLI switch. A window-scoped native Preferences menu action was refused `element_outside_target_window`; exact-window keyboard opened Settings, but AX checkbox/search and foreground scroll/type did not produce an observed change. The main app's CLI socket was absent. Workaround: close the live vault window and run an owned Obsidian instance with a separate HOME/profile over the same live vault; its vault-scoped CLI and Electron events worked. Recipe: `extensions/obsidian-tracker/LIVE.md`. No unscoped desktop input was used; owned instances were stopped after first use.
Workaround: Obsidian's existing desktop CLI, scoped by disposable vault name. The chooser's own `vault-open` IPC registers the fixture folder; CLI eval and Electron input events exercised the rendered Base without modifying the live vault.

disposition, 2026-09-30: kept as evaluation evidence for [[projects/mlegls-pi/issues/buy-a-computer-use-driver]]; the Jev driver's judgment layer is bought, not fixed here.
