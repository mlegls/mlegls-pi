ab daemon [status|stop <id>|shutdown]

Controls the per-user background job daemon. Commands start it on demand; status
prints one JSON job record per line.

  status       start the daemon if needed, then list jobs (default)
  stop <id>    abort a running job and mark it stopped
  shutdown     terminate the daemon; a later command starts it again

The Unix socket and default job files live under $AB_STATE, defaulting to
~/.local/state/ab rather than a per-worktree directory.
