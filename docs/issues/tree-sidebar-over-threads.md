---
stage: ticket
assignee: agent
author: session:01a0f69a-dbcb-7684-87de-422739d2c54e
part-of: "[[projects/mlegls-pi/issues/thread-registry-on-zmx]]"
priority: 2
---

Session mode: hacking. Move `ab tree ui --sidebar` (`lib/tree/workspaces.ts`, `actions.ts`, `ui.ts`, `ghostty.ts`) from tmux to threads ([[projects/mlegls-pi/issues/thread-registry-on-zmx]]).

- the window is the sidebar split plus one main split attached to the selected thread's `.agent`. Selecting a thread switches that split with `ZMX_SESSION=<shown> zmx attach <target>`; no aux terminals.
- both tree modes from `ab thread ls --tree spawn|merge`.
- hover buttons for new / new in worktree / fork / merge / archive / abandon, extending what [[projects/mlegls-pi/issues/tree-sidebar-bridge-fixes]] added; abandon-all-children on a row with children.
- drop the tmux popup dashboard.

First use: write the guide `docs/guide/work-in-threads.md` while driving it, and fill in the story's outcome [[projects/mlegls-pi/stories/work-in-threads]].

## Result

```text
registry spawn / merge rows → point → actions
                           → click / Enter → one .agent client
```

Replaced the tmux dashboard, inferred worktree ancestry and popup actions with registry trees and lifecycle calls. Ghostty opens a fresh sidebar/main window with stable surface binding; hover buttons wrap below rows, destructive actions confirm, and abandonment of children uses the displayed tree. [Guide](../guide/work-in-threads.md) and [implementation first-use setup/evidence](../attachments/tree-sidebar-over-threads/index.md) are committed.

## Evidence

Before: the sidebar listed tmux/workspace windows and could only offer the legacy merge/new actions. After: private-pty first use covered both trees and all actions; native Ghostty showed thread switches and kept the agents alive after window closure. Eighteen affected regressions and typecheck passed. Independent driving/review remains.

The zmx no-leader switch failure found during first use is guarded; its concurrent-disconnect race has an [upstream owner](zmx-switch-without-a-leader-kills-the-source.md). Tool owners: [native Cua input](cua-ghostty-pixel-click-lands-on-another-row.md), [sheet capture](cua-sheet-capture-shows-parent-window.md), [temporary pty teardown](private-pty-sidebar-driver-hangs-at-exit.md).

## Danger

Door: UI code is two-way; confirmed archive/abandon stops processes and removes owned worktrees, so discarded work cannot be recovered by reverting the sidebar.
Blast radius: frontend. Registry/lifecycle and historical plain session listing are unchanged; the obsolete tmux popup dashboard and its actions are gone.
