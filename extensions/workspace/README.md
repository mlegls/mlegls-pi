# Workspace and thread commands

- `/thread new [--worktree <name>]` creates a bb thread through `ab thread`; it starts empty. Without `--worktree`, the CLI creates an owning worktree with an automatic name.
- `/thread archive|abandon|merge [<thread>]` acts on the given thread, default this canonical pi's own; merge aliases archive, including retirement. Cleanup stops the pis in the thread's subtree, so when that includes this pi the command runs detached (output in `$TMPDIR/ab-thread-<action>-<id>.log`) and this pi exits when the thread retires.
- `/new` and `/resume` in a canonical pi move the thread's current session. Free sessions are untouched.
- `/workspace <path>` forks the conversation and switches this pi to that directory. In a canonical pi the thread moves with it, and the worktree it owned and left is closed (worktree and branch); a worktree with unmerged work (uncommitted changes, or commits not in its `ab-parent`) refuses the move, back to the model for a `workspace_request`. Model requests require `/workspace accept`.

Thread commands require `bun`, `pi` and `mise` on PATH and a running bb (threads are bb threads). A new owning worktree runs the project's declared `mise run setup` task; guests do not run setup. Thread records and terminal lifetimes are managed by `ab thread`, not by workspace switching.
