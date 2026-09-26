ab supervise start <ticket> [--budget N] [--test CMD] [--commands-applied N]
ab supervise status [ticket]
ab supervise resume <ticket> <child> verify|integrate|drop|redispatch
ab supervise stop <ticket>

Run from the owning agent's checkout. The ab daemon runs the loop in
lib/jobs/supervise.ts: it dispatches the ticket's ready children (non-leaves get
supervise), takes each leaf implement → encounter → visual review when rendered → integrate, and messages the
owning pi session (in its mailbox, mail/xxxxxxxx) only on exceptions and
when the subtree is done. Children are wm workers with the owner as parent session. To handle an exception, steer the
child directly (its next turn end returns to the loop) or queue a resume action.
A new start continues from the ticket's last job state.
Resume acknowledgements are saved per command. Commands queued before a daemon restart remain pending. An interrupted command's effects may already have happened; the loop stops and reports its 1-based record number rather than replaying it. Legacy nonempty logs without a cursor also require reconciliation. Inspect the reported JSONL log and worker/Git state, then `start <ticket> --commands-applied N` to leave the first N records behind and execute the remainder. This is an explicit recovery override, not a routine start option. An acknowledged command may have reported failure; queue a new resume after repairing its blocker. Do not truncate or replace the command log.

Integration is serialized per repository inside the daemon. `--test CMD` runs in
the child's worktree after rebasing onto the owner, before committing closure and
fast-forwarding the owner. It must use that worktree's setup and leave it clean.
A failed test/close leaves the child available and the owner HEAD unchanged; fix
that child and resume. Closure travels on the child's branch. Completion state is
saved before worker cleanup; a crash during cleanup may leave resources to retire.
Missing worktree paths and reported worker exits are parked as unreachable, not
silently discarded. Resume explicitly after inspecting what already landed.

Verification commits an evidence packet under docs/attachments/<ticket>/; closure
links it from the ticket. Visual encounters get a fresh visual-reviewer before
integration. `resume … integrate` retries accepted work, not an acceptance bypass;
changed work needs `resume … verify`. Old carried workers without the evidence
handoff are parked for an updated report, not grandfathered into acceptance.
See ~/dev/mlegls-pi/docs/verification-evidence.md for the packet and handoff schema.

Code-review boundaries are chosen and delegated by the root supervisor (`supervise`
skill), not inserted at every leaf by this loop. A supervisor's subtree-done
notification precedes its assigned integration review; it reports `done` upward
only after review, repairs and affected verification are complete.
