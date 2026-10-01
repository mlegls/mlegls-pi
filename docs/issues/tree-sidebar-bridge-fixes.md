---
stage: ticket
assignee: agent
author: session:01a0f69a-dbcb-7684-87de-422739d2c54e
part-of: "[[projects/mlegls-pi/issues/threads-on-zmx-with-a-native-sidebar]]"
priority: 3
---

Make the existing `ab tree ui --sidebar` (`lib/tree/ui.ts`, `lib/tree/ghostty.ts`) tolerable until [[projects/mlegls-pi/issues/native-thread-sidebar-in-a-ghostty-fork]] exists. The friction: "needing to manage focus between the sidebar and main bar, and not having 'buttons', like where i can hover where'd i'd expect it and get the archive/merge/new affordances. for instance, i often accidentally scroll through the sidebar and accidentally open a bunch of closed sessions i meant to just 'hover' on".

- try Ghostty's `focus-follows-mouse = true` for splits (in `~/.config/system-config`, wherever Ghostty config lives), so pointing at a split focuses it.
- scrolling moves the view, never the selection; a thread opens only on click or Enter. The accidental opens probably come from selection following scroll and opening on select; confirm that in `ui.ts` before changing it.
- hover buttons via any-motion mouse tracking (mode 1003): draw `[archive] [merge] [new]` on the hovered row. Wire them to [[projects/mlegls-pi/issues/thread-registry-on-zmx]] once it exists; until then, render only the actions that already exist.

## Result

Wheel scrolls the viewport without selecting/opening; j/k select without opening. Sidebar hover uses mode 1003 and offers only the existing `[merge]` (confirmed workmux parent merge) and `[new]` (pi window). No archive is advertised. Ghostty `focus-follows-mouse=true` is committed and deployed from system-config (`17a318c`); the user's running instance still needs its normal config reload.

[First-use setup and observations](../attachments/tree-sidebar-bridge-fixes/index.md): private-pty motion, merge confirmation, scroll/Enter and both agent views worked. The real hidden Ghostty trial was blank and not AX-addressable; native interaction remains pending [[projects/mlegls-pi/issues/cua-hidden-ghostty-has-no-addressable-window]]. The fixture suppresses the legacy [[projects/mlegls-pi/issues/sidebar-ghostty-helpers-target-the-front-window]] helpers. Root typecheck passes after the existing plugin-dependency workaround ([[projects/mlegls-pi/issues/root-setup-still-omits-obsidian-typecheck-dependencies]]); regression timeouts rerun successfully ([[projects/mlegls-pi/issues/host-load-times-out-existing-regressions]]).
