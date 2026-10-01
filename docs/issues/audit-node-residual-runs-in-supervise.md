---
stage: idea
assignee: agent
author: session:01a0dc02-e4ae-775b-bb56-638955494e14
blocked-by:
  - "after: 2026-10-14"
---

Carried to the reconciler 2026-10-01: audit its node-own chains (`startPhaseFrom`), which run a node's residual after its children land; same questions.

Audit how the supervise loop's node-residual step has gone once it has run for a while.

Before d76fdf5, `lib/jobs/supervise.ts` dispatched only a node's children. A spec whose children were all done ended "done: 1 children integrated" or "idle: nothing live, but not done: … (done, not ready)" (archived children counted as not done), and its own stage (joined acceptance, Shape items with no child yet, closing) had no runner. Repeated `ab supervise start` on such a spec did nothing, which read as "specs aren't dispatchable" and drifted into the root supervisor's compaction summaries as a rule ("Spec-stage items need refinement into tickets first, which is outside tend's dispatch scope") despite `tend`, `supervise` and the tracker lifecycle all saying specs dispatch.

d76fdf5: a node whose children are all finished (done or archived) is the loop's leaf and goes implement → drive → review → integrate with its residual; the implementer realizes it, commits children that partition it (the loop runs them and returns), or drives the joined acceptance. The join skips driving the node's stories after that run. A continued finished run reopens when its node still has work. First runs, 2026-09-30 in concept: contrast-as-a-stark-to-soft-slider, record-learning-evidence-for-later-evaluation-of-real-use, generalize-node-memory-to-source-backed-tagged-observations, interactive-lesson-materials-applets-and-blocking-quizzes (via its child spec applet-query-receipt-unsettleable-after-backend-restart).

Questions, from concept's `.git/ab-supervise/*.events.jsonl` and the closed issues:
- How often does a residual run close (acceptance only), realize work, or decompose? Do decompositions converge, or does a node cycle residual → children → residual without shrinking?
- Do residual implementers redo children's work, or close on thin acceptance (a drive of stories the children already held)?
- Does post-order hold up, or do nodes want their residual alongside open children (e.g. residual that is independent of every child)?
- Did spec dispatch stop needing reminders in root sessions (tend), and did any other "specs need refinement first" behaviour survive elsewhere (frontier labels, `effective:spec` read as not ready)?
- The batch loop (`lib/jobs/loop.ts` `finish`) still closes a node after its final join without running its residual; should it share this path?
- Acceptance-only residuals (first runs: contrast, applet-query-receipt, generalize-node-memory) drive the joined acceptance inside implement, then the loop runs drive and review on top. Is the independent drive worth its cost there, or should an acceptance-only residual go straight to review?
