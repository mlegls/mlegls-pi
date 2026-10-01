---
stage: ticket
assignee: agent
author: session:01a0f69a-dbcb-7684-87de-422739d2c54e
part-of: "[[projects/mlegls-pi/issues/threads-on-zmx-with-a-native-sidebar]]"
priority: 2
---

Find out whether zmx's reattach redraw is acceptable with pi attached, in Ghostty. pi draws differentially in the main screen rather than the alternate screen, which is the harder case for state replay. `mise use zmx` (or `nix shell nixpkgs#zmx`) for a one-off.

Run pi in a zmx session and get some scrollback, detach, reattach, then resize while attached and while detached. Compare the screen and native scrollback against pi run directly. Same for one alt-screen tool (lazygit or nvim) as a control.

The answer decides [[projects/mlegls-pi/issues/native-thread-sidebar-in-a-ghostty-fork]]'s main area. If the redraw is good, the fork can close surfaces and reattach on every thread switch. If not, it keeps an LRU of live offscreen surfaces and reattaches only on a cache miss.

result: write the observations, with screenshots in `docs/attachments/check-zmx-reattach-with-pi/` if they help.
