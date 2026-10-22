---
stage: "done"
assignee: "agent"
author: "session:thr_nt35tbjva9"
priority: 2
---
As the maintainer, I want a general project supervisor to discover newly ready work without my reminding shaping threads to tell it. Story: [[projects/mlegls-pi/stories/steer-issues-from-bb]].

2026-10-22, @thread:thr_nt35tbjva9: "could this be automatic based on ticket status, as in a general supervisor directly picks up specs/tickets, so there's no push from shaping threads at all?" After discussing tracker-driven execution and isolated worktrees: "ok, let's file and start a session on the fixes in mlegls-pi then".

## Agreed direction

- The tracker is the handoff: shaping writes the issue, with no outbox or direct readiness message to the supervisor.
- Use the existing whole-subtree frontier (readiness, assignment, blockers, claims), not stage alone. Claim eligible roots atomically and dispatch within the project's configured scope and budget through existing reconcilers.
- Discovery is mechanical code, not periodic model turns. Prefer change-triggered discovery with recovery scanning; duplicates, restart and competing owners must not duplicate execution.
- Ready agent-assigned work within an enabled supervisor's authorized scope is execution-authorized; human-owned/review-blocked work is not. Scope activation and concurrency must be explicit; this request does not authorize consuming every project's backlog or inventing a concurrency budget.
- Exceptions and consequential decisions reach the supervisor/user; ordinary readiness does not require a relay.

## Contract

A pickup is one per repository (git common dir), recorded in `<git-common-dir>/pickup/state.json` and changed only through `lib/reconcile/pickup.ts` (CLI and the `reconcile` namespace tools `pickup`, `pickup_status`, `pickup_stop`).

- **Activation** is explicit: `pickup({scope, budget?, land?, settle?})` from the owning supervisor's bb thread. `scope` lists root slugs (each covers its subtree) or the literal `"project"`; nothing is picked up outside it. A different live owner's pickup is refused (no silent takeover); the owner may change scope/budget at any time.
- **Eligibility**, per scan, from the global tracker snapshot: a row that is `frontier` (ready, agent-eligible, unblocked, unclaimed incl. derived inflight, not deferred), inside scope, with no ancestor that is claimed, inflight or itself frontier (the maximal ready root is taken, never a child of a tree already being worked or shaped), with no reconciler state for that root at all (a stopped or finished run is a human's to restart), and whose subtree's issue files have been unchanged for `settle` (default 60 s) so a tree mid-shaping isn't taken half-written.
- **Start** goes through the existing `reconcile` start (same owner semantics, mail, exceptions, landing), owner = the pickup owner, worker `budget` per reconciler (default 6, as manual). Starts are serialized under the pickup's lock and recorded before returning; the reconciler's own per-root lock and idempotent start make a repeated start a no-op. Pickup-started runs don't mail "started"; the owner hears exceptions and the finish as usual.
- **Concurrency** is the existing configured capacity: each reconciler's worker budget and bb's thread concurrency limits. Pickup adds no global cap.
- **Discovery** is a detached watcher process (no model turns): recursive watch of the canonical issues directory, scan after `settle` quiet; a recovery scan every 5 minutes and at every watcher start. GitHub-tracked projects get only the periodic scan.
- **Pause / stop / restart**: `pickup({paused: true})` stops new starts (running reconcilers continue; stop them with `reconcile_stop`). `pickup_stop` disables and ends the watcher. The owner's session start re-launches a missing watcher of an enabled pickup, as it already does for its reconcilers; watcher start is idempotent (one live watcher per repository, by pid + command line).
- **Review/approval** stay where they are: human-assigned, idea/goal, blocked and claimed trees are never eligible; each reconciler keeps its review phase and exception routing.

Status shows config, watcher liveness, the last scan, recorded starts and per-candidate skip reasons.

## First use

Enable pickup for an isolated scratch scope in a disposable repository, make a previously unready tree ready through a tracker write, and observe exactly one reconciler start without any shaping-thread mail. Blocked, human-assigned, claimed and incomplete subtrees remain untouched. Restart the watcher and repeat the write notification without duplicate starts. Capture evidence and retained limitations under `docs/attachments/pick-up-ready-work-from-the-tracker/`. No existing project backlog is enabled by this work.

Related: [[projects/mlegls-pi/issues/isolate-interactive-edits-in-task-worktrees]]. Preserve manual Supervise and exception-only ownership.

## Result

Done, landed on main (99b95bf5, 23addc09, 92790212). `lib/reconcile/pickup.ts`, plus the `pickup`, `pickup_status` and `pickup_stop` tools in the reconcile namespace, runs one pickup per repository, owned by the bb thread that enables it. The scope must be named explicitly (root slugs or "project"). A watcher process re-reads the tracker when the issue files change and also scans every 5 min. When a maximal frontier root has been quiet for the settle period, the watcher starts the existing reconciler on it once, with no "started" mail. It skips claimed, inflight or frontier ancestors, and roots that already have reconciler state, so a stopped run stays stopped. Each run gets its own worker budget; bb's thread limits are the only overall cap. Pausing holds new starts. The owner's session start relaunches a missing watcher. The shape skill no longer messages the supervisor about readiness. It holds a claim while shaping. The supervise skill documents pickup, and the story steer-issues-from-bb is updated.

First use: a branch-pinned watcher ran against the live bb on a disposable scratch vault. A tracker write made one goal ready, and a run started 7 s later (after the settle period) with no message. Restarting the watcher and repeating the write started nothing new. When that run closed its root, the dependent blocked ticket was picked up once. Claimed, human-assigned, incomplete and out-of-scope trees were never started. Tests: pickup.test.ts and lib/reconcile, 30 pass.

Remaining: no live project is enabled; the maintainer picks the scope and owner. After a host restart the watcher returns only when the owner thread starts a session, the same as reconcilers. The reconcilers' done mails were not observed in-turn.

Evidence: [docs/attachments/pick-up-ready-work-from-the-tracker/index.md](docs/attachments/pick-up-ready-work-from-the-tracker/index.md)
