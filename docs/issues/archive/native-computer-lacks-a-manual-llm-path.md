---
stage: done
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

buy, not build, 2026-09-30: Cua already ships the manual path. `cua-driver` has a CLI (`cua-driver call get_window_state '{"pid":…,"window_id":…}'`, `call click` with an `element_token`, `verify_state`, `list_windows`; https://cua.ai/docs/reference/cua-driver/cli-reference) and an official agent skill (`libs/cua-driver/rust/Skills/cua-driver/SKILL.md` in trycua/cua: observe one exact window, act on a fresh token, verify; pixels only on a fresh target screenshot). On macOS the CLI proxies to CuaDriver.app so the Accessibility/Screen Recording grants belong to that app. Here only the in-process SDK (`@trycua/cua-driver` 0.28.2, used by the exec `ui` runtime) is installed; the CLI and app are not. So the fix is to install `cua-driver` (https://cua.ai/driver/install.sh; granting CuaDriver.app permissions is a one-time human step), enable the upstream skill, and have `docs/computer.md` and the drive/review roles name it as the manual native path, before any osascript. Wrap nothing in `ab` unless something is actually added. The refusal of unscoped System Events input is still wanted.
installed, 2026-09-30: `cua-driver` 0.30.4 via the official installer with `--no-modify-path` (`/Applications/CuaDriver.app`, `~/.local/bin/cua-driver`); mlegls granted Accessibility and Screen Recording. `cua-driver check_permissions` reports both true. A read-only `cua-driver call get_window_state '{"pid":…,"window_id":…}'` on the live Obsidian window returned its AXWindow, AXWebArea and child elements with tokens, so Electron page content is reachable. At that point the remaining work was to enable the upstream skill, document the manual path, and refuse unscoped System Events input. Don't drive the user's own windows while verifying: use a window the worker opened itself.
implemented, 2026-09-30: Added the official Cua `cua-driver` 0.30.4 skill under `skills/enabled/all/cua-driver/`, documented its manual native CLI path in `docs/computer.md`, and prohibited unscoped System Events input in the drive/review roles. First use: a worker-launched TextEdit scratch window exposed its text area and fresh element token; `cua-driver type_text` changed that text and a fresh snapshot read it back. No System Events input was used. TextEdit also restored an unrelated “Untitled 2” window; it was not touched, so the app process remains open.

## Result

[Independent first-use drive](../attachments/native-computer-lacks-a-manual-llm-path/index.md): a worker-owned TextEdit window accepted a fresh-token background edit; rendered text, fresh AX state and `verify_state` agreed. Stale tokens and invalid window scope refused. Documentation/skill discovery and drive/review prohibitions held. Harness-wide skill linking remains the setup handoff's post-integration activation step.

TextEdit restored unrelated documents into a new app instance; that setup/cleanup friction is recorded in [[projects/mlegls-pi/issues/textedit-new-instance-restores-unowned-documents]]. The worker's scratch window was closed and its Cua session ended; restored windows were left untouched.

## Verification evidence

[Encounter and evidence](../attachments/native-computer-lacks-a-manual-llm-path/index.md).
