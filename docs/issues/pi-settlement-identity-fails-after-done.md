---
stage: "ticket"
assignee: "agent"
author: "session:01a1590b-c4de-770e-92a3-7451f7f0155e"
claimed-by: "session:01a1595d-3077-73bf-a6ff-1379103911af"
---
A completed implementation streamed a valid done handoff. bb then marked the turn failed with `Pi extension settlement identity is missing or invalid`. A reconciler automatically asked for the missing status, and bb rejected that continuation with `No active Pi session`.

Observed 2026-10-20 in alchemy-rogue @thread:thr_fcj865y4pz, worker knowledge-render-boundary-implement-e. bb thread log: seq1355–1383 stream done plus the structured handoff; seq1385 provider/error settlement identity; seq1386 turn failed; seq1388–1392 compaction turn; seq1393 reconciler continuation; seq1394–1395 rejection. Provider thread pi_98b178d6-0958-459a-90c0-a80413e668fb; reported child process session 01a15947-bf03-74e3-aaba-1578d9bb39af, pid3830, last state idle. Work was preserved on branch knowledge-render-boundary-implement-e at a757c82, and root @thread:thr_4jsa5zj22r retried preserving it.

Acceptance: completed turns keep their final handoff and legitimate identity across settlement and compaction. Recovering a dead session does not endlessly tell an unavailable session. Strict identity checks stay; no bypass. Production promotion requires user approval. No live-model draws.

## findings (2026-10-20, session:01a1595d-3077-73bf-a6ff-1379103911af)

Evidence and replay harness: docs/attachments/pi-settlement-identity-fails-after-done/index.md on branch `bb/investigate-pi-settlement-identity-failure-after-thr_7uzjwru8sq` (commit 78fd9c46).

- Trigger, mlegls-pi owned and confirmed: the wm fence in extensions/context/index.ts fired at 12:36 (31% of 500k ≥ 0.3). On the final agent_end it called `ctx.compact()` at 53%. Pi 1.2.0's `compact()` calls `abort()` first, so it aborts the run that just completed. A replay with the real bb PiRpcSession, the real bb pi extension, real pi and a faux model shows that turn settling `aborted: true` and failing in bb with "Pi run interrupted unexpectedly". The real session shows that same compaction (entry 12:49:44.943) right after the done message.
- Fixed on that branch: the fence compacts on agent_settled through setTimeout(0), and only if `isIdle()` is true and no messages are pending (the same pattern as OM's compaction trigger). The replay then settles cleanly and compacts afterwards. Not integrated into main.
- Not established: which identity field failed in production. The replay produced the "interrupted" settlement error, not the identity error. I found no pi ordering in which bb's own agent_settled handler, which is the first-loaded CLI extension, sees a non-idle session. An ~8 s child stall (36.9 to 44.8) preceded the failure, so a missed or late report (5 s `gh` timeout) is still possible. The fix removes the in-run compaction that both failures depend on, but the identity-specific mechanism is a hypothesis. If it recurs without the fence, capture the child's channel (fd 3) output.
- "No active Pi session" is owned by bb provider-pi: `failSettlementProtocol()` sets closed and kills the child, and PiRpcSession never respawns, so every later turn on the thread is rejected as non-retryable. Recommendation for bb: resume the session from its file on the next turn, or mark the thread terminally failed so senders stop telling it. Only one rejected tell was observed, which is not an endless loop.
- Separate pre-existing gap: a follow-up that bb sends while post-settle compaction is still running is rejected by pi ("Cannot submit a prompt while compaction is in progress"). The OM trigger has this gap too. It needs its own idea if it matters.

remaining: review and integrate the branch (owner decision; promotion needs user approval). Report the bb respawn defect upstream.
