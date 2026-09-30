ab supervise start <ticket> [--budget N] [--test CMD] [--commands-applied N]
ab supervise status [ticket]
ab supervise resume <ticket> <child> verify|integrate|drop|redispatch
ab supervise adopt <ticket> <child> <run/handle>... [--phase implement|drive|review]
ab supervise stop <ticket>

Run from the owning agent's checkout. The ab daemon runs the loop in
lib/jobs/supervise.ts: it dispatches the ticket's ready children (non-leaves get
supervise), takes each leaf implement → encounter → visual review when rendered → integrate, and messages the
owning pi session's mailbox (mail/xxxxxxxx) only on exceptions and
when the subtree is done. Children are wm workers with the owner as parent session. To handle an exception,
use the `ab mail` address printed in the wake message (or queue a resume action).
A new start continues from the ticket's last job state.

`adopt` takes over a worker the loop didn't launch, e.g. an orphan of a dead loop, at its phase (inferred from
the handle's -drive/-review suffix): the loop consumes the worker's latest report, so a finished phase advances at
once. List earlier workers first (implement before drive); they're retired with it after integration. It queues
into a running supervision of <ticket> or starts one; a lone leaf can be its own ticket.
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
