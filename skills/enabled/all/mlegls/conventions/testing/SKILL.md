---
name: testing
description: "Use when writing or editing tests."
---

Tests come from encounters with the real thing. The maintainer, importing developer and programmer are real users too.

1. Locate the story and the actual use that motivates the test. Try the behavior through that user's surface; retain the actions, inputs and relevant observations.
2. Review the encounter. An assertion belongs where you noticed a failure, uncertainty, expected affordance or promise you were relying on. Mirror what you were trying to do, placing the check at that moment. An intended outcome in a spec is not by itself an assertion inventory.
3. Write the guide and replay together. Reuse the real starting state and step utilities; cache the end state of an upstream sequence when another starts there. At a boundary, save a real value and consume that same value on the other side.
4. Replay the accepted sequence. Update guide and recording together when the journey changes; re-drive what is new or fails. Keep detailed encounter evidence linked from the story.

Never manufacture tests from an implementation checklist or a decomposition into program steps. A lower-level test needs the same grounding in actual use, at that user's boundary. Retain checks for information, not coverage counts: even a trace of speculative test-writing becomes precedent for the next agent.
