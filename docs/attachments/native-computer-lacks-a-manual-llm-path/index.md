# Manual native CLI: first-use drive

## Predictions (before opening a native target, 2026-09-30)

From the ticket, setup handoff and public `docs/computer.md`:

1. **Manual exact-window native interaction.** I expect `cua-driver list_windows` to identify a scratch TextEdit window I open myself. An exact PID/window snapshot should expose a text-area token; one token-targeted edit should change only that document. A fresh snapshot should prove the supplied text. Invalid window scope should refuse rather than type into whichever app is frontmost.
2. **Discoverability and upstream skill.** I expect `docs/computer.md` to name the manual native command beside `chrome-devtools-axi`, with sufficient exact-window instructions to start. Its linked enabled skill should load from this checkout and explain observation, fresh tokens, verification and session cleanup without requiring a decision model.
3. **Drive/review safety policy.** I expect both roles to prohibit all four unscoped System Events operations named in the ticket. This is a role-policy claim, not a claim that macOS blocks arbitrary AppleScript.

## Setup plan

- Tested checkout: `a531cd4dbadf54b534044c449b337640a63a0c23`.
- Deployment: installed native CLI 0.30.4 and shared `/Applications/CuaDriver.app`; checkout-owned product is its documentation/skill/policy, not a separate daemon build. Do not stop the shared daemon.
- Owned target: create a uniquely named scratch text file from this worktree and open a **new TextEdit instance**, then select only that exact file's window. Do not reuse implementer's PID 95075 or the user's windows.
- Persona/auth: local worker, no sign-in; expected existing Accessibility and Screen Recording grants.
- Seed: a temporary document containing `Manual native drive start.`; no destructive seeding.
- Entry point: `cua-driver list_windows '{"on_screen_only":true}'`.
- Skill activation: explicit checkout path via `ab skill ./skills/enabled/all/cua-driver`; harness-wide links are deferred until integration as handed off. No global activation script will run during this drive.

## Session log

Before native first use, the documentation named both browser and native CLIs. Its skill link loaded the official 0.30.4 pack through `ab skill`. The drive and review role texts both explicitly forbade `keystroke`, `key code`, `click at` and `set frontmost` via unscoped System Events. No implementation, diff, tests or fixtures were inspected.

### Preparation and ownership

CLI resolved to `~/.local/bin/cua-driver`, version 0.30.4. `status` reported a running shared daemon PID 77743 in standard permission mode. `permissions status` reported both grants true (direct capture is not checked by this read-only command).

The exact handoff entry point returned desktop window identities; it did not itself prepare a worker target. `launch_app` with `bundle_id: com.apple.TextEdit`, `creates_new_application_instance: true` and the scratch file's absolute path returned new PID **24702**, `window_ready: false`, `self_activation_suppressed: true`. One subsequent `list_windows` found **16011**, title `native-computer-drive.txt`, bounds 661×433 at (210,138). This is distinct from inherited TextEdit PID 95075.

Friction: even a new TextEdit instance restored two pre-existing documents (`Untitled 2` and the implementer's smoke file). Only window 16011 was selected for input; restored windows were not inspected or edited. The public skill warned that a cold launch may require bounded discovery; this expectation was met after one discovery call.

### Manual edit and verification

1. Exact `get_window_state` for PID 24702/window 16011 with session `native-manual-drive` saved [the initial window](01-start.png). The [state excerpt](01-start-state.json) exposed AXTextArea token `s00000009:1`, value `Manual native drive start.`. Background accessibility delivery was available; generic PID keyboard delivery was refused as `same_pid_keyboard_ambiguity` because this process had multiple windows.
2. `type_text` with that exact window target, token, `delivery_mode: background` and text `Manual native drive verified.` returned [confirmed accessibility delivery](02-action.json), 29 characters. No Jev, browser, foreground takeover or System Events input was used.
3. A fresh exact-window snapshot saved [the edited window](03-edited.png) and [state excerpt](03-edited-state.json). Both pixels and AX text showed `Manual native drive verified.Manual native drive start.`. This is insertion at the existing cursor, **not replacement**; the public skill distinguished those operations, so no replace-all gesture was expected.
4. Wondering whether old tokens or invalid scope might accidentally deliver text, I submitted sentinel text with the old token, then with the current token but window ID 0. They returned [stale_element_token](04-stale-refusal.json) and [invalid_action_target](05-scope-refusal.json), both exit 1. Observing window ID 0 returned [window_id_not_found](06-observation-refusal.json), not another window.
5. `verify_state` on the real target asserted the AXTextArea's full exact value with timeout 0, one stable sample. [Satisfied](07-verify.json), 329 ms. The value contained neither sentinel. This establishes the chosen target's state after the refusals, not a global assertion about every app on the desktop.

### Cleanup

A fresh exact-window snapshot supplied close-button token `s0000000b:2`. Background `click` returned [AXPress, effect unverifiable](08-close.json); [subsequent window discovery](10-post-close-windows.json) established that window 16011 disappeared. No save/discard prompt appeared in discovery. [Ending this worker's session](09-end-session.json) returned successfully. No dev servers, browser sessions or recordings were started, and the shared CuaDriver daemon was not stopped.

**Remaining resource:** worker-launched TextEdit PID 24702 still hosts restored windows 16009 (`cua-driver-native-smoke.2AX4ud.txt`) and 16010 (`Untitled 2`), plus an untitled offscreen system window 16008. They were not edited, closed or discarded because their document state was inherited, not created by this worker. This cleanup friction is filed as [[projects/mlegls-pi/issues/textedit-new-instance-restores-unowned-documents]]. The scratch file itself lives under this worktree's `.wm/native-drive/`.

## Story outcomes and expectations

| Story / prediction | Outcome | What happened |
| --- | --- | --- |
| Manual exact-window native observe → token edit → fresh proof | **held / met** | CLI produced tokens; background edit and pixels agreed; verification satisfied. Invalid target and stale token refused. |
| Documentation names the native manual path beside browser CLI | **held / met** | `docs/computer.md` opening lines and Manual native CLI section supplied a working entry point, exact target examples and fresh-observation rule. |
| Official enabled skill can be used from this checkout | **held / met** | Explicit checkout skill activation succeeded; its runtime/workflow/macOS guides provided preflight, launch and cleanup instructions. Global harness link activation remains an integration step, not a drive action. |
| Drive/review forbid the four unscoped operations | **held / met** | Both public role prompts explicitly prohibit them. Policy was inspected; no unsafe command was executed to test compliance. This is prohibition, not runtime enforcement. |
| Cold launch may need bounded window discovery (formed during setup) | **met** | Launch returned no ready window; one later discovery found the scratch window. |
| A fresh process would contain only my scratch document (formed during setup) | **not met** | TextEdit restored other documents into the new process. Exact scratch scope still worked; cleanup left the restored state untouched. |
| `type_text` inserts, not replaces (formed from skill) | **met** | New text appeared before the original content. |
| Fresh observations invalidate old tokens (formed from skill) | **met** | Old token refused without adding sentinel text. |

## Frictions

- TextEdit's new instance restored unrelated documents, defeating an assumption of clean ownership and complicating cleanup. Filed in [textedit-new-instance-restores-unowned-documents](../../issues/textedit-new-instance-restores-unowned-documents.md).
- A cold launch initially had no ready window. The skill explained this and bounded rediscovery worked; no unresolved tooling defect was encountered there.
- `cua-driver --help` advertises management commands but not the direct tool aliases used in `docs/computer.md`. The skill's `describe` guidance resolved parameter discovery; all documented aliases tried worked. No CLI surface failure was encountered.

## Replayable checks (for the reviewer; no tests written)

1. **Scoped background insertion:** create a unique plaintext scratch document containing `Manual native drive start.`; launch a fresh TextEdit instance through `launch_app` with that file; discover and select its title/PID/window ID. Observe fresh state, then pass its AXTextArea token and exact window target to background `type_text` with `Manual native drive verified.`. Accept only a fresh AX value and actual window screenshot showing the expected insertion, plus satisfied exact-value `verify_state`. Never borrow an existing user's document.
2. **Stale token refusal:** capture state A, then state B for the same owned window. Attempt insertion of `STALE MUST NOT TYPE` using A's token and the correct window. Accept `stale_element_token`/refused, nonzero CLI exit and fresh verification of the unchanged document value. Do not retry the action with a refreshed token.
3. **Invalid window refusal:** with a fresh token for the owned window, attempt insertion of `WRONG WINDOW MUST NOT TYPE` with exact target window ID 0. Accept explicit target refusal and nonzero exit; exact observation of ID 0 must return `window_id_not_found`, not another window. Verify the real document remains unchanged.
4. **Native-path discovery:** start at `docs/computer.md`; accept manual browser/native tool names together, a working enabled skill link, an exact-window observation/action recipe, no frontmost fallback, and a usable permissions-status command. Explicitly activate the linked checkout skill and follow its installed-version schema guidance. Harness-wide activation should be verified separately after integration's stated `agents-apply.sh` step.
5. **Role prohibition:** inspect the user-facing drive/review prompts; accept explicit prohibition of unscoped `keystroke`, `key code`, `click at`, `set frontmost`, and instruction to stop if scoped control is unavailable. Do not execute those unsafe operations.
6. **Safe owned-target cleanup:** observe a fresh scratch-window close-button token; act only on that exact window; accept subsequent discovery showing the scratch window absent and successful `end_session`. If other restored documents remain, record them without changing their state. A disappeared window is not proof that the app process exited.

## Images

- [01-start.png](01-start.png): live, worker-opened plaintext TextEdit window before input, seed text readable. Native bounds 661×433 points; captured PNG 1322×866, 2×. English UI, dark appearance, macOS TextEdit.
- [03-edited.png](03-edited.png): same live exact window after background token-targeted insertion. New and original text both readable; title partially clipped in the capture. No geometry/layout claim is made.

State files retain only target metadata and AXWindow/AXTextArea rows; application-menu rows are omitted to avoid collecting unrelated recent-document data. Images were opened and visually checked. This is a single native first-use smoke, not an Electron compatibility or broad concurrency audit.
