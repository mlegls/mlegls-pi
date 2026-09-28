---
stage: idea
assignee: agent
author: "session:concept-tend"
---

Found 2026-09-29 while Concept's `tend` dispatched every frontier spec. Seven Concept specs were on the frontier (`effective:spec`, agent-assigned, no claims) only because their own `stage` is `spec`; every child was already done. `ab supervise start` could advance none of them, in two ways:

- **Archived children read as open.** `lib/jobs/supervise.ts` finishes with `workItems(snapshot(input), input).filter(i => !i.done)`, but the tracker's model sets `done: !i.archived && complete(i, all)`, so a child in `docs/issues/archive/` at `stage: done` has `done: false`. Five loops idled with "nothing live, but not done: <child> (done, not ready)", listing only archived done children: `refine-the-guidelines`, `refine-the-charting-skill`, `refine-the-lesson-skill`, `patches-carry-nodes-edges-and-materials-that-playgrounds-run` (seven archived children), `generalize-node-memory-to-source-backed-tagged-observations`. The tracker's own `effectiveStage` treats archived as done; the loop's `done` field means "listed under done", not "finished".
- **Unarchived done children end in `done` without closing the node.** `record-learning-evidence-for-later-evaluation-of-real-use` and `establish-ui-style-ownership-before-lint-gates` reported "done: N children integrated … join skipped", but the parent stays `stage: spec`, so it stays on the frontier and the next `tend` redispatches it. [[loop-vs-supervision-tree]] says a node whose children are all done "runs a final node join … and closes the node".

What remains in such a parent is either nothing (close it) or scope its children never covered (`record-learning-evidence…` has one child against a multi-part body). Neither path exists: the loop only works children, and a spec with children is not a leaf the implementer can realize or extend. Either the loop runs the parent's remainder as a spec leaf (implement realizes it, commits new children, or closes it) or the frontier stops listing a spec whose children are all done.
