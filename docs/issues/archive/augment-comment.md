---
tags: [task]
stage: done
priority: 1
---

the first sink of [[control plane]]: `comment`, end to end, everything else hardcoded. a bullet in obsidian → palette command → pi → a CriticMarkup comment appears under the bullet. this is the block→workflow→margin path the other three sinks reuse.

pieces:
1. `lib/augment.ts comment <absolute note path> <caret line>`: read the note; the block is the bullet at the caret plus its indented subtree; context is the whole note. run pi non-interactively (`pi -p` or the SDK; see skills/pi) with the grilling skill as the lens: the questions that would need answering to act on this block. re-read the note, locate the block by content, insert the answer as `{>>…<<}` lines nested one level under the bullet; fail loudly if the block moved. direct file write; obsidian picks up external changes.
2. obsidian Shell commands plugin entry (background): `bun ~/dev/mlegls-pi/lib/augment.ts comment {{file_path:absolute}} {{caret_line}}`. document the entry in the augment note's efforts; the plugin config itself lives in the vault's .obsidian.
3. Commentator plugin for rendering CriticMarkup (install note only).

skipped on purpose: routing, jev, the keymap, reply threading, propose/session/implement.

done: running the palette command on a fleeting bullet in ~/obsidian/augment.md yields a rendered comment under it within a minute; temporary implementation signals cover block extraction, insertion, and stale-block refusal.

## decisions

- 2026-09-20: `pi -p` with no tools/extensions/session, the grilling skill in the prompt, and the whole note as context. One compact CriticMarkup comment under the complete bullet subtree; re-read immediately before writing, reject changed/moved/duplicate blocks, preserve edits elsewhere. A synchronous read/write still has the ordinary external-editor race; no locking protocol in v0.
- 2026-09-20: Shell commands 0.23.0 uses `{{caret_position:line}}` (one-based), not `{{caret_line}}`; its file variable shell-escapes paths. Prepend mise shims to PATH for GUI-launched Bun/pi. Output and failures go to notifications; execution is background.
- 2026-09-20: Installed Shell commands 0.23.0 and Commentator 0.2.7 release assets in `~/obsidian/.obsidian/plugins/`, enabled through Obsidian CLI. Commentator is not yet in the community registry: upstream is `Fevol/obsidian-criticmarkup`. Live Shell commands reload left palette commands unregistered; explicitly registered them and reopened/refreshed the palette.
- 2026-09-20: Both astra and luna initially hit the 55s cutoff in Obsidian, while terminal invocation succeeded. Cause: the already-running GUI lacked Xray proxy exports. Source `~/.config/xray/proxy.env` if present, following `~/.config/system-config/home/.zshrc`, in the palette command. Pin this small lens to `openai-codex/gpt-5.6-luna`, low thinking; terminal signal took 16.2s, corrected palette invocation 11.3s.
- 2026-09-20: Per hacking scope, no permanent test file. A disposable Bun signal checked subtree extraction including blank lines/nesting, insertion, and refusal after movement/content changes/added descendants. This supersedes the original `bun test lib/augment.test.ts` clause.
- 2026-09-20: End-to-end signal passed: selected the supertags bullet in `~/obsidian/augment.md`, searched the real command palette and clicked its suggestion through Obsidian CLI DOM automation. Pi wrote the comment in 11.3s; external reload and Commentator `.cmtr-anno-gutter-annotation` rendering were verified. Left the comment in place and documented the installed command in the note’s efforts. No Obsidian restart required.
- 2026-09-20: Exec dogfood frictions: `grep(...).context(...)` on the unresolved promise failed (fixed with `(await grep(...)).context(...)`); cooked `sh` turned a nested `\n` into a broken Bun string (used `sh.raw`). A direct Obsidian executable piped to `head` hung until the 30s exec deadline and cleared kernel state; the `obsidian` CLI via `term` worked. `ui.act` advised focus-following `typeText` without a ref but rejected it, and the next explicit ref was stale; switched to Obsidian CLI DOM automation. Proposed improvements: consistent UI focus semantics and clearer async-selection ergonomics, not changes to this feature.
- 2026-09-20: Integration frictions left for later: Commentator also renders literal CriticMarkup examples in the note’s table; the compact answer is one paragraph to avoid multi-line parser ambiguity. A temporary reply-threading prompt returned delimiter text and was rejected rather than risking malformed markup. No retries, routing, or threading added.
