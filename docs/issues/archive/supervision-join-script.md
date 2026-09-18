---
tags: [task]
status: x
next: done
parent: "[[projects/mlegls-pi/issues/agentic-setup-reorg]]"
---

orchestrate steps 3–4 as a workflow script: wait → merge → test → classify with jev {clean, needs-merge-attention, needs-decision, respawn}. The script handles clean joins, one conflict handback, and bounded checkpoint respawns; decisions return to the coordinator with the report and a Jev-selected evidence excerpt.

done: a run supervised end to end, coordinator receiving decisions only; after-spawn ingress measured against the audit's 18.6 MB / $2134 baseline.

## implementation

2026-09-18: lib/supervise.ts exports supervise; CLI takes a JSON request with run, handles (handle/ticket path/agent), and testCommand. Pending returns resumable state; the caller resolves with wm.send or edits the active handles, then invokes again next turn. No wake primitive. Disable coordinator wake subscriptions to worker topics: the script cannot suppress another session's board delivery.

Retry workers keep the same configured agent and branch from the retained checkpoint branch. Tickets are reread, retries default to two. Conflict handback is limited to once per worker incarnation. Clean cleanup requires a done report, successful merge and passing tests regardless of classifier output. Standalone acknowledgements are protocol ack messages plus persisted seen IDs, not another session's delivery acknowledgements.

## evidence

- Temporary fake-wm/decide signals passed: clean ack/close ordering, conflict → re-wait → clean, repeated-conflict escalation, same-agent/ticket/checkpoint-base respawn, retry exhaustion, failed-test cleanup guard, ask → pending → resume. No retained test files.
- Live Jev classified three recorded reports from the board log (read only): mu75jlwb-tbldcs → clean p=.83; mu1md5pr-lrtdsx → respawn p=.39; mu0vyci8-h1q50b → needs-decision p=.69. Merge/test evidence for these classifications was synthetic; report text was not.
- Real local run supervise-e2e-1789748266632: isolated temporary repo and board, workmux shell worker, committed result file, real wait-any → git merge → shell assertion → live Jev → ack → close. One report, zero coordinator decisions, zero respawns, **310 bytes** of returned compact JSON (plus CLI newline); zero intermediate worker reports delivered to the coordinator. Worktree removal verified. Temporary repo/session cleaned up.
- 310 B versus the audit's 18.6 MB is an ingress measurement, not a workload-normalized reduction claim. The fixture used a shell worker with a scripted commit/report, not an autonomous coding assignment. Coordinator model cost was not measured; no savings against $2134 are claimed. Production-run cost/ingress comparison remains follow-up measurement.
- Full existing suite: 130 pass, 2 skip, 0 fail. Typecheck has existing errors elsewhere; none in supervise.ts.

Metrics accumulate returned compact JSON bytes across pending/resume/done, excluding caller/tool framing. Current limits: process interruption is not a transactional journal; retained checkpoint branches need eventual cleanup; wm.close itself does not surface workmux removal failures. Classifier checkpoint probability was low despite correct routing: no confidence threshold was added.
