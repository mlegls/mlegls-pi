---
stage: idea
assignee: agent
---

Concept notes drift from landed code because nothing between decision and garden compares them. In concept, [[projects/concept/issues/archive/make-proposal-acceptance-visible-to-the-tutor]] landed yield and resume on 2026-09-21 (`e263795a`), while `docs/application/concepts/Confirmation.md` still said "Accepting or declining creates no response turn." Code-level LLM review would double implementation time and cost; Jev and deterministic lints are acceptable.

Prototype `span/contradicts_concept` in `lib/lint`, a sibling of `expect/off_concept`: judge each span a change adds (`extract.ts` with `sinceRef`) with the concept notes whose `path:` covers it, asking whether the code contradicts something the note claims. Pairing may matter more than wording: Confirmation's `path:` is `confirmation-card.tsx`, but the contradicted claim is enacted in `convex/turn.ts` and `convex/confirmations.ts`.

Calibrate on the 2026-09-21 specimen (the proposal-acceptance landing against the unchanged Confirmation note) plus negatives from landings whose notes were updated (e.g. `63f72e2c`, per-session model and `Settings.md`). If it separates, add it to the nondeterministic lints `implement` runs.

The issue-side counterpart is `tracker-lint`'s `theory` rule: an issue whose decided shape contradicts a linked concept, story or theory without saying it revises it. Probe 2026-09-24: p=0.84 on a Confirmation contradiction, no signal once the issue named the revision.
