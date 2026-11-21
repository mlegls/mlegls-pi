---
stage: "done"
assignee: "agent"
priority: 2
author: "session:thr_fc4rfkdz6s"
---
Since 5338837a ("Accept reviews with only post-landing checks", [[review-blocked-only-on-a-post-landing-check-escalates]]), the reconciler lands a review whose only blockers the reviewer labels post-landing and closes the issue `stage: done`, writing the checks as prose under **Pending post-landing checks**. Nothing names who runs them, records their outcome, or reopens the issue when one fails. The lifecycle contract (`skills/enabled/all/mlegls/conventions/tracker/references/lifecycle.md:31`) requires the body to name "the post-landing gate that carries the acceptance and who owns it".

Seen in concept on 2026-11-20 (adversarial review, @thread:thr_mz2t3egh9x and @thread:thr_d5692bjwxj): four issues are `done` with unrun checks: `skip-promotion-rehearsal-for-an-already-rehearsed-migration-set` (its Result says `blocked`; the retry that should skip the rehearsal has never run), `serve-the-docs-as-markdown-and-link-them-from-the-tutor`, `bounded-review-replay-refuses-its-fresh-scratch` (its first "post-landing" check is reading the landed recipe, which could run before landing) and `check-published-consumers-before-publishing-open-packages`. One historical check replayed as acceptable was "publishes core 0.2.1 with provenance", the version later found to break published consumers.

## Done when

An auto-landed post-landing check has an owner and a recorded outcome: e.g. the issue stays open (or gets a child) until each check reports, a failed check reopens it, and checks a reviewer could run before landing are refused as post-landing. A replay with one red post-landing verdict shows the owner getting actionable work.

## Result

done. The replay held all three stories. Review found one lost-verdict case: a second submission before the reconciler’s next tick could overwrite the first. The second call now refuses with retry instructions; the red verdict reaches the owner and remains in the final issue Result. All 19 affected tests passed. The disposable target was removed.

```yaml
commit: f0af62d5
stories:
  - story: A checkout-runnable recipe read cannot be deferred as an undeclared post-landing gate.
    outcome: held
  - story: Landing assigns the declared checks to the run owner and keeps the ticket open.
    outcome: held
  - story: A red verdict gives the owner actionable work; closure retains verdict history after both checks pass.
    outcome: held
evidence:
  path: docs/attachments/post-landing-checks-close-with-no-owner/index.md
  visual: false
  shots: []
tests:
  - lib/reconcile/checks.test.ts
  - lib/reconcile/completion.test.ts
  - lib/reconcile/exceptions.test.ts
  - lib/reconcile/ownership.test.ts
  - lib/reconcile/setup.test.ts
fixed:
  - "371aee38: Prevent overlapping submissions from replacing an unprocessed verdict."
  - "f906ccfd: Make the fixture CLI acknowledge queued verdicts and give the status command."
filed: []
caveats:
  - Target eligibility relies on the ticket author correctly declaring a target-triggered check. Review rejects undeclared checks by ID.
  - Deployment verdicts were simulated. The replay exercised the reconciler, Git, and tracker without a live deployment.
```

Evidence: [docs/attachments/post-landing-checks-close-with-no-owner/index.md](../attachments/post-landing-checks-close-with-no-owner/index.md)
