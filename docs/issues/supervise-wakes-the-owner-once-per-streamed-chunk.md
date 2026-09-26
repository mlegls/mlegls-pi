---
stage: idea
author: session:97e2e1e0-915e-48c2-8bd3-0f9ecd53c817
part-of: "[[projects/mlegls-pi/issues/scripted-supervision-loop]]"
---

Seen supervising `~/dev/mmon/concept`, 2026-09-25, job `supervise-refine-the-chat-session-layout-with-a-scripted-llm-provider-mugdi0rj`, child `keep-the-latest-response-button-steady-near-the-bottom` verify (agent `0380e07e`): one verifier turn end reached the owner as ~20 separate "verification did not hold cleanly" wakes, each carrying a longer prefix of the same final message (`commit: "8c987d8…"`, then `setup: "Own-worktree…`, … up to the complete yaml). `children.turnEnd` appears to fire on each timeline update of a finishing turn rather than once on its end, and the loop's `except` wakes each time.

In the same burst the loop also reported `loop error: Cannot replace agent 97e2e1e0-… because its active run cancellation was not acknowledged`: `children.send` to the owner while the owner was mid-turn tried to replace the owner's run rather than queue the message.

Done looks like: one wake per child turn end, with the final text; a wake to a busy owner queues.

Same noise from supervise-phase children: every turn end of a child supervisor that is waiting on its own loop arrives as `turn ended: closed` (the `end.kind !== "finished"` branch runs before the `phase === "supervise" && status === null` skip), so the owner is woken each time a child supervisor checks in. Seen repeatedly for `capture-learner-and-tutor-friction-reports-in-convex-for-manual-review`, `start-a-session-from-a-proposed-skill` and `whole-evidence-through-bounded-transactions`.

September 26 transport follow-up: the busy-owner send failure is confirmed against original session metadata and daemon logs. Paseo sends are now removed; two real mailbox writes queue while a simulated owner is busy and deliver once, in order, after restoring pending state and becoming idle. Injected watch/write failures also retry without failing the current supervision loop. [Evidence, runnable probe and limits](../research/historical-transport-failures-2026-09-26.md). This checks the busy-owner clause, not the separate streamed-prefix/check-in noise observations above.
