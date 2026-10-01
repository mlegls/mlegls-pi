# Workspace and thread commands

- `/thread new|fork [--worktree <name>]` creates a thread through `ab thread`. Fork keeps the conversation; new starts empty. Without `--worktree`, the CLI creates an owning worktree with an automatic name.
- `/thread promote` makes this free session canonical in a guest thread. `/thread archive|abandon|merge [<thread>]` acts on the given thread, default this canonical pi's own; merge aliases archive, including retirement. Cleanup stops the pis in the thread's subtree, so when that includes this pi the command runs detached (output in `$TMPDIR/ab-thread-<action>-<id>.log`) and this pi exits when the thread retires.
- `/fork-tab` aliases `/thread fork` (including `--worktree <name>`). It no longer opens tmux windows.
- `/new` and `/resume` in a canonical pi move the thread's current session. Quitting pi restarts it on that session. Free sessions are untouched.
- `/workspace <path>` forks a new thread in that directory when this pi is canonical, leaving the original alone. In a free session it forks the conversation and switches this pi to the new directory. Model requests require `/workspace accept`.

Thread commands require `bun`, `pi`, `mise` and `zmx` on PATH. A new owning worktree runs the project's declared `mise run setup` task; guests do not run setup. Thread records and terminal lifetimes are managed by `ab thread`, not by workspace switching.
