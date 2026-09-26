---
name: verify-story
description: "Use to check that the product does what a story claims: drive it as its user would and record what you observe."
argument-hint: "a story, subtree, or changed journey"
---

First-use acceptance belongs to a fresh verifier under supervision. Standalone self-checks are useful but are not independent acceptance. Keep this pass to the changed journey; broader hypothesis-driven auditing is a separate assignment.

1. Read the story, intended outcome and existing evidence. Use the prepared starting state and the persona's real surface: browser, CLI, API or library. Resolve missing setup yourself when the path is known and authorized; report an actual blocker rather than returning routine preparation to another agent.
2. Replay accepted recordings for unchanged paths. Drive new or changed behavior through actual use, using `computer.run/step/walk` in exec. From bash, use `ab computer --url URL --until 'visible end state' 'INTENT'` for an isolated browser, or `--browser ./setup.ts` to reuse the project's authenticated setup. Native desktop journeys require `--app` or `--window`; do not borrow another worker's window. See `~/dev/mlegls-pi/docs/computer.md`. Write or revise the guide just before and during that encounter, alongside the action recording; correct both against the interface. Follow the project's development docs for recording.
3. Review the use log, screenshots and relevant state. What went wrong, what was uncertain, what promise did an action lead you to rely on? Put checks at those moments in the recorded sequence (`testing`), then replay it. Re-drive failing or changed portions rather than rediscovering the whole journey.
   Fix in-contract gaps when you have the context and authority, then re-drive the affected behavior and refresh its evidence. Repair size alone is not a handoff rule. Hand off when missing context, authority or expected cost warrants it; changed contracts go to shaping. A repair does not automatically commission another verifier.
4. Keep the story's supported behavior and limits current; link detailed evidence rather than accumulating drive transcripts there. A counterexample becomes an issue with its originating story, reproduction and author/session. Distinguish failures of the intended claim from other discoveries.
5. Report what held, failed or remains unobserved. What stays unobserved after this ticket closes needs an owner: link the issue that will observe it, or file one (`tracker`). A green recording proves only what its reviewed checks cover. Acceptance and digestion need no human involvement unless a decision or interactive feedback requires it.

Under supervision, preserve the encounter packet and use the exact handoff in `~/dev/mlegls-pi/docs/verification-evidence.md`. The loop sends rendered journeys to a fresh visual reviewer before integration. Missing requirements remain blocked; moving them into caveats or a follow-up does not satisfy the ticket without an explicit scope decision.
