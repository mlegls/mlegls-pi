---
stage: idea
assignee: agent
author: session:01a0f09c-60e3-715e-8568-1f5859aeff64
---

While driving [[projects/mlegls-pi/issues/archive/bounce-handoff-shape-errors-to-the-child]], the setup handoff supplied `bun test lib/jobs/supervise.test.ts lib/report.test.ts` as the backend story entry point. In the drive checkout at `d3c60f7`, that command completed with three passes and zero failures. Its output named only generic tests, not the child/owner recipient, diagnostic text, retry sequence, or parser line for any malformed handoff. The first-use packet at `docs/attachments/bounce-handoff-shape-errors-to-the-child/index.md` records the attempted command and the specific missing observations. The shared daemon had not yet loaded this change; no owned live subtree or mock-worker entry point for sending handoffs was provided. The workaround was to confirm harness readiness and mark routing claims unobservable, without treating the green test as user-level evidence.

A setup handoff for backend supervision should include a reproducible, checkout-owned black-box mock-worker route and observable outbound messages (or a safe way to capture them) for the stated scenarios. This is a suggestion, not an observed defect in the new routing logic.

For this ticket, acceptance review added observable report/mail fixtures to `lib/jobs/supervise.test.ts`: the replay now prints each scenario's recipients and complete diagnostics, asserts the second-report escalation, and exercises corrected reports and truthful non-held reviews. This resolves the supplied entry point's visibility gap for these scenarios; the general setup-handoff suggestion above remains separate.
