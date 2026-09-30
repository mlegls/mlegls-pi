ab service start [--ttl SECONDS] -- COMMAND ARG...
ab service stop ID
ab service list [--status running,queued,done]

Start a foreground dev server in an owned process group. Returns a JSON receipt
with id, log and cwd; this is not a readiness claim. Default lifetime: 1800s,
maximum: 86400s. The daemon stops the group on expiry, stop, or normal daemon
shutdown. SIGKILL of the daemon and children that daemonize/setsid escape cleanup.
Services do not occupy check slots. No automatic restart or cross-worktree reuse.

Start only the environment you own, wait for readiness, use it, then stop its ID
before handoff even on failure. Record the startup recipe, not a lingering URL.
Use a longer explicit ttl for a long drive; the timeout is a backstop, not an
idle detector. Logs and receipts are available in ab service list and expire
an hour after exit while the daemon runs. Stdin is closed; argv, not shell text.
