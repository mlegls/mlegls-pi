ab supervise start <ticket> [--budget N] [--test CMD]
ab supervise status [ticket]
ab supervise resume <ticket> <child> verify|integrate|drop|redispatch
ab supervise stop <ticket>

Run from the owning agent's checkout. The ab daemon runs the loop in
lib/jobs/supervise.ts: it dispatches the ticket's ready children (non-leaves get
supervise), takes each leaf implement → verify → integrate, and messages the
owning pi session (board topic session/<PI_SESSION_ID>) only on exceptions and
when the subtree is done. Children are wm workers with the owner as parent session. To handle an exception, steer the
child directly (its next turn end returns to the loop) or queue a resume action.
A new start continues from the ticket's last job state.
