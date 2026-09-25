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
