ab tree ui [--sidebar] [QUERY]      interactive: dashboard, or a narrow persistent sidebar
ab tree open|park|send ID [TEXT]    act on one session (send reads stdin without TEXT)
ab tree [-m tree|projects|status] [-a] [--json] [--days N] [--hours N] [QUERY...]

Every pi session on this machine as a node: its parent (wm spawn, the bash tool that
ran it, a fork, or its Paseo parent), project, model, and state. Sessions are files, so
one without a process still shows:

  ● working  ○ idle  ◌ live (Paseo, state unknown)  ◇ parked (worktree kept, no process)
  · ended    × gone (cwd deleted)
  !  waiting on you (board needs-input/checkpoint)   ⊘ blocked   orphan: alive, parent ended

Without a query it shows active sessions plus those ended in the last --hours (12);
-a shows everything in the --days window (3). QUERY terms are ANDed: key:value for
state, project, model, kind (spawn/invoked/fork/paseo/root), run, orphan; bare words
fuzzy-match title, project and cwd; a leading ! negates. In tree mode a match keeps
its ancestors.

  ab tree state:needs            what's waiting on me
  ab tree -m status              grouped by state, orphans near the top
  ab tree project:concept !state:gone

The TUI (? inside it for keys) opens sessions in tmux (focus their pane, or reopen a parked
one with pi --session in a window of a session named after the project), parks them, sends
them messages, and opens tuicr/yazi/nvim/zed in their directory; tuicr's exported review can
go straight back to the agent. Bind it in tmux, e.g.
  bind t display-popup -E -w 90% -h 90% "ab tree ui"
  bind T split-window -hbf -l 36 "ab tree ui --sidebar"
