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

Interactive means pi's TUI mode, not "has no parent": a spawned worker can have a TUI.
For older sessions without recorded mode, invoked children default to non-interactive and
others to interactive.

Without a query it shows active sessions plus resumable ones from the last --hours (12);
-a shows everything in the --days window (3). QUERY terms are ANDed: key:value for
state, project, model, kind (spawn/invoked/fork/root), run, orphan; bare words
fuzzy-match title, project and cwd; a leading ! negates. In tree mode a match keeps
its ancestors.

  ab tree state:needs            what's waiting on me
  ab tree -m status              interactive first, then non-interactive; each grouped by state
  ab tree project:concept !state:gone

The TUI (? inside it for keys) has three views (s cycles): workspaces (git worktrees,
with tmux sessions and windows), agents grouped by interactive vs non-interactive sessions,
then by status, and sessions grouped by project with parent/child nesting. The session tree
sorts sibling subtrees by urgency; folded nodes and projects show needs-you counts. A child in
another project starts a root there, with a reference to its parent. The dashboard
(prefix-t) shows a live preview; the sidebar is a Ghostty split beside tmux. In workspace view
j/k switch workspaces;
in session views j/k select agents (or project headers in the tree) and switch to live
agent windows immediately. Enter opens or resumes one; h/l fold and expand the session tree.
x closes the selected window, X its session;
p on a parked worktree removes it if clean and idle; U removes all such worktrees in dashboard
projects (including those hidden by the recent-activity filter). Both ask for confirmation,
leave dirty or busy worktrees alone, and keep branches. Neither key removes the main checkout.
n/c/N create a pi window, terminal, or worktree. On a project heading in either project
view, they use the main checkout.
The tmux heading in workspace view stays visible even when there are no free sessions.
Select it and press n to create a free pi session or c for a free terminal session, both
starting in ~. Sessions with no matching project workspace stay under tmux; navigating into
a project from a free session can move it under that project on refresh. On an existing
free session, n/c add windows starting in ~.
Mouse works; ? shows the keys.
The sidebar's r refreshes data; R reloads code in the same split (no pane restart).
