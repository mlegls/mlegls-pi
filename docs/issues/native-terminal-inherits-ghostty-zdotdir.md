---
stage: "idea"
assignee: "human"
author: "session:01a1590b-c4de-770e-92a3-7451f7f0155e"
---
During alchemy-rogue native Terminal first-use verification (drive @thread:thr_c5v3rxtdr3, root @thread:thr_4jsa5zj22r), a Terminal opened with `cua-driver launch_app` and a .command URL started zsh with ZDOTDIR=~/dev/mlegls-pi/apps/threads/.build/arm64-apple-macosx/release/GhosttyKit_GhosttyTerminal.bundle/Ghostty/shell-integration/zsh. That directory had no .zshrc, so zsh-newuser-install ran, ate the first character of Terminal's `<path> ; exit;` line, and the command failed as `Users/...`. Seen twice on 2026-10-20.

## cause (observed 2026-10-20, session:01a15939-7ce0-704f-bb90-8ad0f5d0f3ff, @thread:thr_a8hkfgmdkf)

- The shared `cua-driver serve` daemon (pid 2655, started 2026-10-03 15:47, ppid 1, LaunchServices XPC service) still has the environment of a pi agent that ran inside the deleted Threads.app (GhosttyKit embed): ZDOTDIR, GHOSTTY_RESOURCES_DIR, TERMINFO, MANPATH and XDG_DATA_DIRS under apps/threads/.build, GHOSTTY_BIN_DIR=~/Applications/Threads.app/Contents/MacOS, TERM_PROGRAM=ghostty, AB_THREAD_ID/ZMX_SESSION f7563ec2…, PWD ~/dev/mmon/concept. The Threads app was deleted in 052ae66f (2026-10-14). The daemon has kept that environment since.
- `open` passes the caller's environment to the app it launches. Probe: `PROBE_MARK=from-bash open -n -g <probe.app>` from a bb thread, and the probe saw PROBE_MARK. That is how the daemon got this environment: the cua-driver CLI starts it through `open -n -g -a CuaDriver --args serve`.
- Reproduced: `cua-driver call launch_app '{"bundle_id":"com.apple.Terminal","creates_new_application_instance":true}'` started Terminal pid 64303. Its login `-zsh` (64309) had that stale ZDOTDIR. The isolated instance was killed afterwards.
- This bb thread's own environment has no ZDOTDIR or GHOSTTY_*. bb and the current Ghostty.app (pid 30711, own integration dir) are not the source. launchctl getenv ZDOTDIR is empty.
- Side effect: /etc/zshrc_Apple_Terminal runs `mkdir -p $ZDOTDIR/.zsh_sessions` and zsh writes $ZDOTDIR/.zsh_history. So every leaked Terminal re-creates the untracked `apps/` tree in the canonical checkout (birth 2026-10-20 19:58), with .zsh_history and .zsh_sessions only. One session entry there (20:14) came from the reproduction above.

Not established: why that Threads-era agent had Ghostty's ZDOTDIR in its environment. Ghostty's zsh integration normally restores it in .zshenv. Conjecture: Threads launched agents without going through an interactive zsh. That code is gone, so this is moot.

## recommendation

Ownership: no current mlegls-pi source sets this. The bad state lives in a long-running third-party daemon. Fix, done by the user or root at a moment when no worker is using cua-driver: `cua-driver stop`, then restart it from a clean bb shell (`open -n -g -a CuaDriver --args serve` or any cua-driver call, which auto-starts it). Check the result with `ps eww -o command= -p $(pgrep -f 'cua-driver serve') | tr ' ' '\n' | grep ZDOTDIR`, which should print nothing. Then delete the untracked ~/dev/mlegls-pi/apps/. No dotfile change is needed.

Open follow-ups, unowned: (a) the daemon also carries API keys and proxy variables from that old shell, and launch_app hands them to every app it starts. Asking upstream for launch_app to use a clean environment would cover both. (b) Native-setup guidance could say that apps started by launch_app inherit the daemon's environment. Neither is filed.

Retained evidence: /Users/mlegls/dev/games/alchemy-rogue__retired/knowledge-minds-and-forms-drive-c/.wm/friction.md (its content is summarised above, so it can go). The packet on alchemy-rogue branch knowledge-minds-and-forms-drive-c is at docs/attachments/knowledge-minds-and-forms/index.md.

## Recurrence 2026-10-20 (session:01a15988-4155-717a-bb1d-bc016bba964e)

While preparing alchemy-rogue knowledge-notebook-substances first use, `cua-driver launch_app` with `/tmp/knowledge-notebook-substances.command` again hit zsh-newuser-install and consumed the leading slash; Terminal reported `no such file or directory: tmp/knowledge-notebook-substances.command`. No daemon restart or shell configuration mutation attempted because the daemon is shared. The owned failed Terminal window was closed via its exact AX close button. A checkout-owned foreground tmux server running the ordinary binary provided the terminal interaction route instead; native screenshot acceptance remains for the supervised driver. Originating story: projects/alchemy-rogue/stories/learn-what-an-unknown-lot-is.
