ab tree ui [--sidebar] [QUERY]      interactive: dashboard, or a narrow persistent sidebar
ab tree open|park|send ID [TEXT]    act on one session (send reads stdin without TEXT)
ab tree [-m tree|projects|status] [-a] [--json] [--days N] [--hours N] [QUERY...]

Every pi session on this machine as a node: its parent (wm spawn, the bash tool that
ran it, a fork, or its Paseo parent), project, model, and state. Sessions are files, so
one without a process still shows:

  ● working  ○ idle  ◌ live (Paseo, state unknown)  · resumable (no process; pi --session)
  × gone (cwd deleted)
  !  waiting on you (board needs-input/checkpoint)   ⊘ blocked   orphan: running or pending in a worktree, parent is neither

Without a query it shows active sessions plus resumable ones from the last --hours (12);
-a shows everything in the --days window (3). QUERY terms are ANDed: key:value for
state, project, model, kind (spawn/invoked/fork/paseo/root), run, orphan; bare words
fuzzy-match title, project and cwd; a leading ! negates. In tree mode a match keeps
its ancestors.

  ab tree state:needs            what's waiting on me
  ab tree -m status              grouped by state, orphans near the top
  ab tree project:concept !state:gone

The TUI (? inside it for keys) is organized by workspace: one per git worktree, nested by
the branch it came from, each shown as its tmux session. The dashboard (prefix-t) has the
workspace tree on the left and the selected workspace's windows and agents on the right
(l to move in), with a live preview; s switches to all agents grouped by state. The
sidebar is the tree alone: a click switches to that workspace. bin/ab-sidebar keeps one
sidebar pane following you between windows (prefix-T toggles it, remembered). Mouse works.
