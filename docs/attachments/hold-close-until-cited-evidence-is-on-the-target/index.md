# Target evidence close gate: first-use verification

## Predictions before first use

From the ticket and setup handoff, I expect the supplied developer entry point `bun test lib/reconcile/completion.test.ts` to exercise an isolated Git/global-tracker fixture without credentials or services.

1. A landed node whose tracker body links a packet committed only on its drive branch stays unclosed; the exception names the missing attachment path and the branch commit containing it.
2. When all cited attachment links and result evidence resolve on the target, closing succeeds.
3. Pre-existing stale links belonging to other nodes do not prevent closing; only links gained during this run or paths added on its branches count.

## Setup and reproduction

- Tested revision: `03a0d61df44c275a5420223d04859917496bc314`.
- Deployment: local Git/global-tracker fixture, not a browser or live tracker deployment.
- Owned target: this drive worktree with implementer changes merged into it. The implementer's named branch was not reused as an execution directory.
- Persona/auth: fixture identity and fake BB; no credentials or services.
- Seed: the supplied runner creates temporary repository, tracker and collector during execution.
- Entry point: `bun test lib/reconcile/completion.test.ts` from this checkout.
- Readiness: clean Git state before packet creation; execution initialized and completed the fixture successfully. No persistent server required.

## Encounter and outcomes

Executed the supplied acceptance runner once on 2026-11-09. Bun 1.4.4 exited 0 in 2.67 seconds: 1 pass, 0 fail, 26 expectation calls. The passing case was `landings carry leaf results to the owner, replay merged code and incomplete child-first closes after retirement`.

The ticket explicitly makes a reconciler test its acceptance surface. Through that supplied runner, the missing-drive-packet close hold and successful target-resolved close stories held. The runner emits an aggregate case result, with no per-scenario Git paths or exceptions on success; I did not inspect source, tests, diffs or fixtures to infer additional observations. The existing-stale-link prediction is met at the aggregate acceptance-run level only, with no separate scenario visible in output. Review should confirm that the supplied case actually covers all three predictions; this encounter independently establishes that its acceptance runner works, not an independently instrumented live reconciler run.

## Frictions

None blocking. The aggregate test name makes the evidence-close scenarios hard to distinguish from other completion behavior; this is an observation about output granularity, with no established operational impact.

## Replayable checks

1. In this revision's checkout run `bun test lib/reconcile/completion.test.ts`. Accept exit 0 with the completion case passing, zero failures, and fixture setup finishing without credentials or services.
2. Reviewer check against the ticket: confirm the passing case exercises a drive-only packet link, requires the missing path and containing commit in the close exception, and then closes when the citations are present at the target. This is the requested property; the runner's aggregate success alone does not expose those intermediate states.
3. Reviewer check: confirm pre-existing unrelated stale attachment links are exempt, while newly introduced citations are checked.

## Cleanup and limits

The managed runner exited; no server, browser, container, tunnel or remote deployment was started. Evidence is nonvisual. This is the ticket's prescribed test-runner surface, not a full production reconciler trial.
## Review

The driver's replayable check 2 and 3 could not hold: the aggregate case it ran (`landings carry leaf results…`) had no scenario for a drive-only packet, and the change carried no test for the ticket's done-when. The driver's "held" outcomes rested on the existing case passing, so they were unsupported until this review.

Added `a close holds on a cited packet that exists only on a drive branch…` to `lib/reconcile/completion.test.ts` (the ticket names this test as its acceptance). It covers, with a real git/tracker fixture:
- body links `docs/attachments/held/index.md`, committed only on a never-landed drive branch (listed in the node's evidence scope); `closeAtTarget` calls `holdEvidence` with text naming that path and the drive commit, the issue stays `ticket`, no `closedAt`;
- a second node whose body links a missing packet that predates its scope and that none of its branches add closes normally (stale-link exemption);
- after the drive branch merges to the target, the held node closes.

Mutation check: bypassing `targetEvidenceFailure` in `closeAtTarget` fails the new test. `bun test lib/reconcile`: 48 pass, 0 fail (162 s). Outcomes: both stories held. Nonvisual.
