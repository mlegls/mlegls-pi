---
stage: "done"
assignee: "agent"
priority: 2
author: "session:thr_vrgtjptnu2"
---
# Gate and rebase repairs go to the handler, not a review session

When a reviewed node's rebase conflicts or its `pre-integrate` gate fails, the reconciler relaunches the review role (Opus/Astra) to rebase, format or resolve conflicts. Of 31 profiled visual reviews 11-08→11-22, 5 were only this, about $21: `held-update-refusal-shows-a-raw-material-tuple-review-3` ($10.88, a rebase and a cherry-picked applet format fix main already had), `chat-lesson-briefly-closes-as-paused-after-success-review-6` (formatting main's AP Biology applet), `answer-quiz-code-problems-in-the-browser-review-2n` ($5.05, two small conflicts), `re-record-the-bounded-and-timed-lesson-routes-on-the-joined-context-review-1a` (one typecheck line). Three reviewers formatted the same applet. Found by the 2026-11-23 efficiency audit (@thread:thr_vrgtjptnu2); the maintainer asked for this ticket.

## tasks

1. In `lib/reconcile/landing.ts`, an integration failure that is a rebase conflict, a format or lint failure, or a typecheck failure in lines the node didn't touch launches `handler` (Sol high) with the failing tail and the node's reviewed head, instead of a new review round. It counts against the node's repair budget.
2. If the handler's repair changes behaviour (any non-format edit inside the node's own diff), the node goes back to review as now.
3. A format failure in a file that main already has wrong is fixed once on the target, not per node: the handler formats on main's tip in its own commit and the node rebases.
4. Done when: tests send a conflict-only and a format-only failure to `handler` with no new review session, and a repair that edits the node's own code back to review.

## Result

done. The ticket's contracts hold on the final head. I fixed one defect in the format routing, and the three fixture replays plus the review-routing test pass after my change (6 pass, 0 fail).

**What I fixed** (`799da9c0`):
- **Format failure in a file the node changed.** Any failing file that also existed on the target was sent to a handler on main's tip. If the node had introduced the bad formatting itself, that handler would find the target clean and report `targetFormatAbsent`, and a second handler would then run on the node's branch. That costs two of the node's repair budget of 2. Now only files the node didn't touch go to the target, and the rest are formatted once on the node's branch as a format-only repair with no new review.
- **Pretty tsc output.** The typecheck pattern didn't recognise `file:3:5 - error TS…`, so those failures went back to review. It now does. Concept passes `--pretty false`, so this only matters elsewhere.

**The driver's three unobservable stories**, checked by hand rather than replayed:
- **Lint and untouched-line typecheck:** I ran the classifier against this checkout's real history. The results are in a table appended to the packet.
- **Repair budget:** I read it rather than replayed it. Handler repairs count against `BUDGET.repair` and survive a phase restart, and when you resolve the exhausted-budget exception the count resets, like the other repair budgets.
- **Second node reusing the target format fix:** also read only. A node that needs the same target fix waits while a sibling's target handler is live, then sees main has moved, drops its own job and re-lands on the fixed tip.

The other 21 commits in this range came from other tickets merged into the branch. I reviewed only the three for this ticket (two implementation, one drive record).

```yaml
commit: 7b16fc80
stories:
  - story: Conflict-only repair lands through the handler without another review
    outcome: held
  - story: Inherited formatting is fixed in a separate target commit before the node lands
    outcome: held
  - story: A handler edit to reviewed code returns the repaired head to review before landing
    outcome: held
  - story: Lint and untouched-line typecheck failures route to the handler
    outcome: held
  - story: A handler repair debits the node's repair budget
    outcome: held
  - story: A second node reuses the target formatting fix
    outcome: held
evidence:
  path: docs/attachments/gate-and-rebase-repairs-go-to-the-handler-not-a-review-session/index.md
  visual: false
  shots: []
tests:
  - lib/reconcile/landing.test.ts
filed: []
fixed:
  - "799da9c0: format failures in files the node changed went to a target-tip handler, then a second node-branch handler (two repair debits); now formatted once on the node branch"
  - "799da9c0: pretty tsc diagnostics (`file:L:C - error TS`) were unclassified and went to review; now typecheck"
caveats:
  - "Budget and second-node stories are held by reading advanceLandingRepair and running gateRepair against this checkout's history (table in the packet), not by replay; the fixture has one node."
  - "Lint routing sends any lint failure to the handler, including lint in the node's own lines; repairNeedsReview still returns the head to review when the fix edits reviewed lines."
  - "With an empty file list, a handler's self-reported formatOnly is trusted with no file check."
  - "A target format commit is dropped without landing if main moved by non-tracker commits meanwhile; the node re-lands and may spend another repair."
  - "The implementer replaced the old conflict test's assertions (child-mail path) with handler-route assertions, as the ticket required."
  - "caveat: three new real-Git + reconciler fixture tests, ~6–8 s each (~20 s added to landing.test.ts), for end-to-end fidelity of routing."
  - "Handler routing is agents/handler.md (Sol high, Opus medium fallback); the fixture's fake BB shows stance/handler, so live Sol selection is unverified."
```

Evidence: [docs/attachments/gate-and-rebase-repairs-go-to-the-handler-not-a-review-session/index.md](../attachments/gate-and-rebase-repairs-go-to-the-handler-not-a-review-session/index.md)
