---
stage: done
assignee: agent
---

Concept notes drift from landed code because nothing between decision and garden compares them. In concept, [[projects/concept/issues/archive/make-proposal-acceptance-visible-to-the-tutor]] landed yield and resume on 2026-09-21 (`e263795a`), while `docs/application/concepts/Confirmation.md` still said "Accepting or declining creates no response turn." Code-level LLM review would double implementation time and cost; Jev and deterministic lints are acceptable.

Prototype `span/contradicts_concept` in `lib/lint`, a sibling of `expect/off_concept`: judge each span a change adds (`extract.ts` with `sinceRef`) with the concept notes whose `path:` covers it, asking whether the code contradicts something the note claims. Pairing may matter more than wording: Confirmation's `path:` is `confirmation-card.tsx`, but the contradicted claim is enacted in `convex/turn.ts` and `convex/confirmations.ts`.

Calibrate on the 2026-09-21 specimen (the proposal-acceptance landing against the unchanged Confirmation note) plus negatives from landings whose notes were updated (e.g. `63f72e2c`, per-session model and `Settings.md`). If it separates, add it to the nondeterministic lints `implement` runs.

The issue-side counterpart is `tracker-lint`'s `theory` rule: an issue whose decided shape contradicts a linked concept, story or theory without saying it revises it. Probe 2026-09-24: p=0.84 on a Confirmation contradiction, no signal once the issue named the revision.

done 2026-09-24: `lib/lint/drift.ts`, run by `run.ts` beside the span lints, not a span kind. The unit is (note, change): notes pair by `path:` or by title matching a changed file's word (`confirmations.ts` → Confirmation); a Jev choice over the note's sentences picks the contradicted statement and a yes/no verifies it. Per-span judgment with `path:`-paired notes separated nothing. It flags the specimen (8c47c38c 0.63, 447b2802 0.46–0.60) and found a second real drift in 447b2802: SkillHints stopped scoping errors to the responding card, which Session still claims; 16 unrelated commits stay at or below 0.20. Calibration in `lib/lint/README.md`.
