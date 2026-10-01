---
stage: ticket
assignee: agent
author: session:01a0f69a-dbcb-7684-87de-422739d2c54e
part-of: "[[projects/mlegls-pi/issues/thread-registry-on-zmx]]"
blocked-by: ["[[projects/mlegls-pi/issues/thread-core-and-workers-on-zmx]]"]
priority: 2
---

Session mode: hacking. Move `ab tree ui --sidebar` (`lib/tree/workspaces.ts`, `actions.ts`, `ui.ts`, `ghostty.ts`) from tmux to threads ([[projects/mlegls-pi/issues/thread-registry-on-zmx]]).

- the window is the sidebar split plus one main split attached to the selected thread's `.agent`. Selecting a thread switches that split with `ZMX_SESSION=<shown> zmx attach <target>`; no aux terminals.
- both tree modes from `ab thread ls --tree spawn|merge`.
- hover buttons for new / new in worktree / fork / merge / archive / abandon, extending what [[projects/mlegls-pi/issues/tree-sidebar-bridge-fixes]] added; abandon-all-children on a row with children.
- drop the tmux popup dashboard.

First use: write the guide `docs/guide/work-in-threads.md` while driving it, and fill in the story's outcome [[projects/mlegls-pi/stories/work-in-threads]].
