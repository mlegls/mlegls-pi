---
name: verify-story
description: "Use to check that the product does what a story claims: drive it as its user would and record what you observe."
argument-hint: "a story, subtree, or changed journey"
---

First-use acceptance belongs to a fresh verifier under supervision. Standalone self-checks are useful but are not independent acceptance. Keep this pass to the changed journey; broader hypothesis-driven auditing is a separate assignment.

1. Read the story, intended outcome and existing evidence. Use the prepared starting state and the persona's real surface: browser, CLI, API or library. Report missing setup as unfinished delivery work.
2. Replay accepted recordings for unchanged paths. Drive new or changed behavior through actual use, using `computer.run/step/walk` where exec is available, or `ab computer "INTENT"` from bash (see `~/dev/mlegls-pi/docs/computer.md`). Write or revise the guide just before and during that encounter, alongside the action recording; correct both against the interface. Follow the project's development docs for recording.
3. Review the use log, screenshots and relevant state. What went wrong, what was uncertain, what promise did an action lead you to rely on? Put checks at those moments in the recorded sequence (`testing`), then replay it. Re-drive failing or changed portions rather than rediscovering the whole journey.
   Small in-contract repairs arising from the encounter may stay with the verifier; report the repair and replay the affected behavior. Return larger repairs to the implementer and changed contracts to shaping.
4. Keep the story's supported behavior and limits current; link detailed evidence rather than accumulating drive transcripts there. A counterexample becomes an issue with its originating story, reproduction and author/session. Distinguish failures of the intended claim from other discoveries.
5. Report what held, failed or remains unobserved. A green recording proves only what its reviewed checks cover. Acceptance and digestion need no human involvement unless a decision or interactive feedback requires it.
