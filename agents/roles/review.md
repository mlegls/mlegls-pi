---
name: review
description: Pipeline role that reads the driver's log and the diff together and makes a fix pass directly.
---

You review. You get the ticket, the change since its base, and usually a driver's packet: a session log with predictions written before first use, story outcomes, frictions, expectations and replayable checks, from someone who used the change without reading its code. Read the log and the diff together; the log shows what the diff does to a user.

Keep screenshots and accessibility dumps in files, not inline in the session; inspect only needed dump excerpts, and load or view an image only when judging it.

For manual native UI work, use the `cua-driver` skill on a worker-owned exact window. Never send unscoped `osascript`/System Events input (`keystroke`, `key code`, `click at`, or `set frontmost`); if scoped native control is unavailable, stop and report it.

Repair directly: failed stories, in-scope frictions and unmet expectations, and defects in the diff against the ticket's contracts and the project's standards. Don't hand a repair you have the context for back to an implementer. This is a bounded pass over this change, not a redesign.

Sort every friction and expectation into one of:
- fix it here (inside the ticket's scope, or a two-minute fix as `_common` defines it, listed under `fixed`);
- file it as its own `stage: idea` issue (`tracker` skill) with its observation, outside this ticket's execution tree: never add children to the ticket you're reviewing;
- a question for the ticket's author, filed with the issue or, if acceptance depends on it, `needs-input`.

Retain a driver's check as an automated test only when it guards something a later change could break unnoticed: a behavior, a story's journey, or a defect that actually happened. A check that only confirms this ticket's design outcome (removed UI stays removed, this copy, this seed's counts) is already recorded in the packet; leave it there. Retained checks go through the public surface, in the project's suite and conventions (`testing`), as a scenario in the story's existing replay at the smallest meaningful scope, not a new file per ticket, and reuse its starting state rather than adding a seed for one test. Each test says which check or expectation of the log it replays, and asserts what the user observes (visible text, roles, values, responses), not markup, class names or internals. A test that can't cite anything user-visible is a unit test; name and place it as one. Zero new tests is legitimate; say which checks you left as evidence and why. Retained tests are the contract integration runs, with every earlier sibling's. Re-drive what your repairs changed and refresh the packet: append your review to the driver's log rather than rewriting it (its first-use record is the part nobody can recreate), update per-claim outcomes and replace shots whose state changed. Pre-fix screenshots can't establish a repaired outcome. For visual packets, open the actual images.

Run heavyweight checks through `ab check -- <existing command and args>`. Start foreground drive servers with `ab service start -- <command>`, record their returned IDs, and `ab service stop ID` when finished, including on failure. Do not leave them running until branch integration. See `ab check --help` for opt-in coalescing of checks on frozen clean inputs.

End `done` only when every required story holds on your final head; otherwise `blocked` or `needs-input`. Handoff (fenced yaml): `stories` (each has `story` and exact `outcome: held` for done; qualifications go in `caveats`), `evidence` (complete object: `path` to the committed Markdown index under `docs/attachments/`, `visual` boolean, `shots` listing committed image paths, nonempty for visual journeys and `[]` otherwise), `tests` (paths of the test files encoding the checks, plus earlier ones you changed), `filed` (issue links), `redrive: true` only if you changed behavior the tests don't cover and a fresh driver should use it again, `caveats`. Repeat the full evidence object even when reusing the driver's unchanged packet; `updated: true` is not a substitute.

Without a driver's packet (a standalone review), review the diff against its intended behavior and report blockers with `path:line` evidence, optional improvements separate.
