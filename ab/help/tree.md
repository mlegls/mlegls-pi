ab tree ui [--sidebar] [QUERY]      interactive: dashboard, or a narrow persistent sidebar
ab tree sidebar                     open the sidebar as a Ghostty split left of the focused terminal
ab tree open|park|send ID [TEXT]    act on one session (send reads stdin without TEXT)
ab tree [-m tree|projects|status] [-a] [--json] [--days N] [--hours N] [QUERY...]

Every pi session on this machine as a node: its parent (wm spawn, the bash tool that
ran it, or a fork), project, model, and state. Sessions are files, so
one without a process still shows:

  ● working  ○ idle  · resumable (no process; pi --session)
  × gone (cwd deleted)
  !  waiting on you (board needs-input/checkpoint)   ⊘ blocked   orphan: running or pending in a worktree, parent is neither

Without a query it shows active sessions plus resumable ones from the last --hours (12);
-a shows everything in the --days window (3). QUERY terms are ANDed: key:value for
state, project, model, kind (spawn/invoked/fork/root), run, orphan; bare words
fuzzy-match title, project and cwd; a leading ! negates. In tree mode a match keeps
its ancestors.

  ab tree state:needs            what's waiting on me
  ab tree -m status              grouped by state, orphans near the top
  ab tree project:concept !state:gone

The TUI (? inside it for keys) has three views (s cycles): workspaces (git worktrees,
with tmux sessions and windows), agents by status, and sessions grouped by project with
parent/child nesting. The session tree sorts sibling subtrees by their most urgent session;
collapsed nodes and projects show needs-you counts. A child in another project starts a
root there, with a reference to its parent. The dashboard (prefix-t) shows a live preview;
the sidebar is a Ghostty split beside tmux. In workspace view j/k switch workspaces;
in session views j/k select agents (or project headers in the tree) and switch to live
agent windows immediately. Enter opens or resumes one; h/l fold and expand the session tree.
x closes the selected window, X its session;
n/c/N create a pi window, terminal, or worktree.
Free (untagged) tmux sessions stay under tmux even when their panes are inside a project.
On one of those sessions, n and c start new windows in ~; on a workspace they use its path.
Mouse works; ? shows the keys.
