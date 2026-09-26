ab supervise start <ticket> [--budget N] [--test CMD]
ab supervise status [ticket]
ab supervise resume <ticket> <child> verify|integrate|drop|redispatch
ab supervise stop <ticket>

Run from the owning agent's checkout. The ab daemon runs the loop in
lib/jobs/supervise.ts: it dispatches the ticket's ready children (non-leaves get
supervise), takes each leaf implement → verify → integrate, and messages the
owning pi session (in its mailbox, mail/xxxxxxxx) only on exceptions and
when the subtree is done. Children are wm workers with the owner as parent session. To handle an exception, steer the
child directly (its next turn end returns to the loop) or queue a resume action.
A new start continues from the ticket's last job state.

Integration is serialized per repository inside the daemon. `--test CMD` runs in
the child's worktree after rebasing onto the owner, before committing closure and
fast-forwarding the owner. It must use that worktree's setup and leave it clean.
A failed test/close leaves the child available and the owner HEAD unchanged; fix
that child and resume. Closure travels on the child's branch. Completion state is
saved before worker cleanup; a crash during cleanup may leave resources to retire.
Missing worktree paths and reported worker exits are parked as unreachable, not
silently discarded. Resume explicitly after inspecting what already landed.
