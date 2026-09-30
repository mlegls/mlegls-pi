---
stage: idea
assignee: agent
priority: 2
author: session:01a0f065-abaf-776c-bc8b-419cb9b312e4
---

The computer tool has two modes: execution by a decision model (`computer.run/step/walk`, `ab computer`: code builds bounded native actions from Cua elements and Jev selects one), and manual LLM use, where the agent observes and acts itself. For browsers the manual path is `chrome-devtools-axi`. For native windows it's missing from bash: `ab lib` refuses host-bound modules ("computer's native ui … fail here"), so a bash-only worker's only native path is `ab computer`, the Jev-driven one.

On 2026-09-30, three Obsidian drive/review workers fell back to `osascript`/System Events after `ab computer` failed ([[projects/mlegls-pi/issues/computer-obsidian-vault-chooser-native-drive]], [[projects/mlegls-pi/issues/computer-obsidian-base-semantic-drive]], `background_unavailable`). The `obsidian-implement-sink` reviewer sent unscoped `keystroke`/`key code` input (⌘Z, ⌘P, "Augment: implement", Enter) to whatever was frontmost; one landed as a message in mlegls' pi session.

Wanted:
- a manual native surface from bash, scoped like `ab computer` (`--window PID:WINDOW_ID`): observe (Cua window state and element tokens) and act on a token, with no frontmost fallback. `docs/computer.md` names it next to `chrome-devtools-axi`.
- unscoped System Events input (`keystroke`, `key code`, `click at`, `set frontmost`) refused or at least forbidden in the drive/review roles.

Related: Obsidian is Electron, so its page content is likely hidden from AX unless `AXManualAccessibility` is set, and it can be driven over CDP (`--remote-debugging-port`) with `chrome-devtools-axi`. See [[projects/mlegls-pi/issues/cua-background-compatibility]].
