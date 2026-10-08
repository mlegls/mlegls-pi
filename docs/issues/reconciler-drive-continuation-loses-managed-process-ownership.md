---
stage: done
assignee: agent
author: "session:01a0f86d-9beb-71bb-8518-b44c8d4eebbd"
---

Done: a worker that reports `checkpoint` while its session still runs a managed process is not relaunched. The reconciler repairs it, telling it to report `waiting` until the process completes and checkpoint after that, and the checkpoint does not count against `BUDGET.checkpoint`. A test in `lib/reconcile` covers both outcomes of `runsProcess`.

Owner: mlegls-pi reconciler / drive continuation tooling.

Drive evidence: [checkpoint transition packet](../attachments/reconciler-drive-continuation-loses-managed-process-ownership/index.md). Library behavior held; live worker wiring and regression coverage remain for review.

Encounters, 2026-10-01/02 (full accounts in this file's git history before 2026-10-08):
- [[projects/concept/issues/fold-welcome-browser-journey-onto-fresh-accounts]]: `drive-18` checkpointed while awaiting its replay's completion notice; its continuation `drive-1a` ran in a new session, inherited no managed processes, and asked whether to adopt the old services or provision again. Workaround: ownership-verified adoption, with provenance and cleanup responsibility.
- [[projects/concept/issues/reconcile-folded-browser-scenarios-on-the-common-seed]]: `implement-1i`, waiting on an inherited 124-case run, alternated plain waiting and checkpoints, raising "checkpointed 3 times" and `status (after 2 repairs)` repeatedly ("The harness rejects plain waiting but turns checkpoints into exceptions"). `drive-1s` and [[projects/concept/issues/run-the-kept-browser-batch-on-a-fresh-seed-with-one-command]]'s worker `22` yielded `needs-input` for pending completions, and each answer to hold spawned another handler.
- snapshot implement continuation `48fbeda1-5a2d-43dd-b56d-6b588053a805` inherited a checkpoint naming `proc_13`: `process wait` returned "Process not found … No processes have been started in this session" while the original checkout's builder was still alive.

## Earlier encounter (merged from checkpoint-continuation-cannot-observe-inherited-managed-processes)

During [[projects/concept/issues/reconcile-folded-browser-scenarios-on-the-common-seed]], worker `implement-1e` was launched in a new worktree/session from `implement-1d`'s checkpoint while the original 124-case browser batch and its services remained alive. The checkpoint instructed the continuation to await managed `proc_10`'s automatic completion notification. `process logs proc_10` instead returned `Process not found: proc_10. No processes have been started in this session.` The running Playwright PID and report directory still belonged to `implement-1d`; the continuation had none of its ignored deployment/build/report state. Workaround: confirm the original checkout/config/readiness and exact live process, preserve its run without reseeding, then start a managed Node `fs.watch` observer for its completed report file in the continuation session. Cleanup must still explicitly stop the inherited checkout's services. [[projects/concept/issues/attachments/browser-replay-rulings/combined|Encounter and common-seed packet]].

## State, 2026-10-08

The plain-waiting loop above predates the `waiting` status (ffdc983, 2026-10-02): a worker may now end `waiting` on a process it started without raising, and one whose session runs no managed process is told so after 2m (`WAITING_VOID_MS`). Recheck that the loop is gone; no recurrence since is recorded. What remains is a checkpoint while the worker's session still runs a managed process: `onReport` (`lib/reconcile/reconcile.ts`, `status === "checkpoint"`) relaunches in a new session, which cannot own that process.

decisions:
- 2026-10-08 checkpoint with a live managed process: the reconciler refuses it. On a checkpoint report, if `runsProcess(handle)` is true, repair with "wait for your running process (report `waiting`), then checkpoint after it completes" instead of relaunching; the checkpoint stays uncounted. Rejected: resuming the same session (defeats the context reset a checkpoint is for) and a durable completion/log handoff (the hand-built `fs.watch` workaround as machinery; more general, more to build; revisit if a worker runs out of context partway through a multi-hour run).

## Verification evidence

[Encounter and evidence](../attachments/reconciler-drive-continuation-loses-managed-process-ownership/index.md).
