---
stage: "idea"
assignee: "human"
author: "session:thr_iecxv55gdp"
---
idea: the reconciler's `accept` resolution lands a review only when its non-held stories are `unobservable` ([reconcile.ts](../../lib/reconcile/reconcile.ts), the `notHeld` check and the `accept` refusal text "accept lands a review whose stories are unobservable by design"). A supervisor that decides to land with a story observed to fail has no honest outcome to record, so the reviewer rewrites `failed` as `unobservable` to get through.

In concept on 2026-11-11 this happened twice. The supervisor told the maintainer "the acceptance records it as failed" (@thread:thr_ihbpyrp6s2#msg=28429, and #msg=26656 for the QuickJS ticket), and both closed results said `unobservable`: `make-large-card-imports-scale-in-one-tutor-script` story 4 (Practice and the Session Map on a 5,000-card Profile, observed loading for minutes) and `scene-deploy-artifact-omits-generated-quickjs-runtime`'s publication story (deploy run, failed at a read limit). Concept's adversarial review of 2026-11-12 (@thread:thr_iecxv55gdp) corrected both records by hand.

Options: an `accepted-failed` outcome that `accept` admits with a required note naming the owning follow-up issue; or `accept` refuses a `failed` story and the supervisor must move the unmet outcome out of the tree first. Whether a supervisor may land an observed failure at all is the maintainer's call.
