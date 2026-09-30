---
stage: done
assignee: agent
author: "session:01a0e5e9-67b7-732e-90ce-7e6ac7a4ad76"
---

On 2026-09-28 the TypeSafe Decision API returned HTTP 503 for a stretch. A 503 at a supervised child's launch (a Jev classification in the launch path) failed the whole supervise job. For Concept's contrast tickets (check-edition-contrast-floors-across-hues and its resolve-stark-to-soft follow-up), that left the work parked until the API recovered. The same outage showed up in children's handoffs as "residual lint unavailable", which is harmless because those lints are advisory. Related transient failure: [[projects/mlegls-pi/issues/jev-decision-api-returns-http-520-during-browser-drive]].

Done when a 5xx or network failure from the Decision API at launch is retried with backoff, or the step it feeds is skipped as advisory. It should not end the job. A persistent outage should surface once as a clear "Decision API unavailable" state that the owner can resume.

triage, 2026-09-30: a 402 (credits exhausted, seen 2026-09-30 in [[projects/mlegls-pi/issues/computer-drive-refused-by-typesafe-credit-exhaustion]]) is the persistent case: no retry, surface it once.

review boundary, 2026-09-30: the supervise-loop group (bounce-handoff-shape-errors-to-the-child, address-the-waiting-child-in-exception-mail, supervise-job-dies-on-a-decision-api-503-at-child-launch, surface-stale-waits-after-owner-replies, turn-end-sentinel-parser-rejects-preambles) is reviewed once as a combined delta from `894e8c6` by the root tend session after all five integrate, before the next `ab daemon shutdown` loads them. This is a code review of the combined diff; each leaf's own acceptance review (evidence packet against the ticket) still runs.

Result: [First-use Decision API outage drive](../attachments/supervise-job-dies-on-a-decision-api-503-at-child-launch/index.md).

## Verification evidence

[Encounter and evidence](../attachments/supervise-job-dies-on-a-decision-api-503-at-child-launch/index.md).

combined code review, 2026-09-30 (root tend session, `894e8c6..275ae59`, lib/jobs/supervise.ts, lib/report.ts, lib/decide.ts, lib/board/subscribers.ts, lib/board/scopes.ts): accepted with one repair. `repairReport` sent the drive/review stories+evidence schema to every phase, so an implementer bounced for a missing sentinel or bad YAML was told to replace its `commit`/`setup` handoff with `stories`/`evidence`; non-drive/review/consolidate phases now get a sentinel-plus-own-role-handoff instruction. Residuals, left as is: a status conflict from `lib/report.ts` travels as `handoffError`, so its bounce is labeled "handoff YAML parse error"; any line that is only a status word counts as a sentinel candidate, so a lone `blocked` line in prose turns a `done` report into a conflict bounce. Focused suites (lib/jobs, lib/report, lib/decision-outage, lib/board) pass.
