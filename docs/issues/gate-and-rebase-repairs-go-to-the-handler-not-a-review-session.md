---
stage: "ticket"
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
