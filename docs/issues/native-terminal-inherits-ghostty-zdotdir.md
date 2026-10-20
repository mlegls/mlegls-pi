---
stage: "idea"
assignee: "agent"
author: "session:01a1590b-c4de-770e-92a3-7451f7f0155e"
claimed-by: "session:01a15939-7ce0-704f-bb90-8ad0f5d0f3ff"
---
During alchemy-rogue native Terminal first-use verification, Terminal inherited ZDOTDIR pointing at bb Ghostty shell integration. Opening a .command or .terminal CommandString triggered zsh-newuser-install, consumed the first slash, then failed with `no such file or directory: Users/...` or `bin/sh`. Observed twice on 2026-10-20; manually entering the command after aborting startup worked. No shell configuration was changed.

Suspected environment leakage, not a proven root cause. Investigate where native app launches inherit bb terminal-specific environment and fix at the owning boundary if confirmed, preserving intentional terminal integration. Do not change global user dotfiles as a workaround.

Origin: alchemy-rogue root supervision @thread:thr_4jsa5zj22r; drive thread @thread:thr_c5v3rxtdr3. Retained report: /Users/mlegls/dev/games/alchemy-rogue__retired/knowledge-minds-and-forms-drive-c/.wm/friction.md. Evidence packet on the knowledge collector branch: docs/attachments/knowledge-minds-and-forms/. Inherited value pointed under ~/dev/mlegls-pi/apps/threads/.build/arm64-apple-macosx/release/GhosttyKit_GhosttyTerminal.bundle/Ghostty/shell-integration/zsh.

User authorized filing harness defects and starting independent bb threads without asking. Any production promotion still requires the user. Live-model draws, if needed, share a campaign cap of $1 total on default models; none spent so far.
