ab check [--ttl SECONDS] [--share INPUT-IDENTITY] -- COMMAND ARG...
ab check list

Run a finite check through the per-user ab daemon's two-slot queue. Output and
exit status follow the command. Commands are argv, not shell strings; use bash
-c '...' for a pipeline. Stdin is closed. Default execution timeout: 3600s.
Nested ab checks inherit the parent's slot; a task tree must not detach work.

--share coalesces only overlapping calls in the same clean worktree with the same
HEAD, argv, timeout and input identity. It is not a completed-result cache.
The identity asserts identical ignored inputs (dependencies, generated files,
local configuration), environment and external state. Do not edit or install
while a shared check is queued/running. Omit --share for dirty work or checks
with effects. Never use a branch name alone to identify external inputs.
HEAD and worktree cleanliness are checked again before execution and on exit;
changes invalidate the shared result. Ignored inputs still need the caller's
identity and must remain frozen.

Example: ab check -- bun-axi run typecheck
For a frozen checkout with dependencies installed from its lockfile and no
other inputs: ab check --share lockfile-install -- bun-axi run typecheck

All callers see the same execution ID/log/exit status when sharing. Cancelling
one waiter leaves the others running. Stopping your waiting ab check caller
releases it immediately; a caller that disappears without releasing expires
after 30s. Execution IDs are not ab daemon job IDs. SIGINT exits the caller
with 130; a running command is terminated with SIGTERM, so its receipt can
instead record 143 with reason `no waiting callers`.
A daemon-request timeout while waiting retries the same execution/client receipt,
not the command. SIGINT/SIGTERM still release the caller. The 30s caller lease
still applies; a longer outage can expire it. A daemon restart is not recoverable.
Timeout/cancellation terminates its process group; daemonizing/setsid children
are unsupported. Done logs/receipts expire after an hour while the daemon runs.
The queue is per AB_STATE (normally per user), not per orchestration loop.
Commands bypassing ab check are not constrained. Parallelism inside one command
is still the command's responsibility. No automatic replay after daemon restart.
