# Workspace commands

- `/workspace <path>` forks the conversation into another directory and switches this Pi instance to it. Model requests require `/workspace accept`.
  Connectome continues the existing life rather than rebuilding memory from the transcript.
- `/fork-tab` snapshots the current conversation branch into a new Pi session and opens it in a new tmux window in the same tmux session. The original stays open.
- `/fork-tab <worktree-name>` first creates a Git worktree and branch from current HEAD using `cyber-mux worktree add`, then opens the fork there. The checkout goes in cyber-mux's default location, beside the primary checkout. Uncommitted changes are not copied; existing branch/path conflicts are reported rather than overwritten.

`/fork-tab` requires tmux and `pi` on PATH; the named form also requires `cyber-mux`. It waits for the agent to become idle before taking the snapshot. A worktree is retained if opening the window fails (its path is reported). No dependency installation or project setup hooks are run.
