# Independent driver encounter

## Predictions before first use

Revision: 4166ee2438f6eddd84a5717cff5606ce4ab3885f. Persona: local operator using the supplied CLI/library acceptance entry point. Setup completed by the worktree setup task. Deployment: invocation-owned disposable scratch repositories and isolated host sequence; no credentials. Entry: `bun docs/attachments/reconcile-submitted-pr-reviews/probe.ts`. This is seeded API sequence evidence, not live GitHub.

From the ticket and setup docs I expect:
1. A lone comment launches no worker; quiet approval is processed without merging.
2. Submitted changes-requested and associated unresolved threads launch one repair from the latest PR head; the real shell worker commits, gates and pushes before replying to every requested thread.
3. Replaying the same review, including interruption after reply publication but before saving, produces no duplicate replies or new worker. A later review arriving during repair remains available.
4. A second later changes-requested submission raises an owner exception with relevant links and previous repair details, and launches no second repair.
5. Approval never causes a host merge; an external human merge completes the target.

Replayable checks: run the supplied entry point on this revision; accept only exit 0 with reported worker/commit identities, two thread replies, one worker, zero host merge calls, second-review owner exception and completed target. Inspect the resulting report for actual scratch target and cleanup. No source, fixtures or tests inspected by this driver; probe is treated as the supplied public entry point.

## Encounter

2026-10-14: invoked the documented entry point, without inspecting its source or implementation. Exit 0 after 57 seconds. All five predicted seeded lifecycle outcomes met according to the supplied runner's successful checks and public report.

Actual owned target: `/private/tmp/rc-pr-lifecycle-9cxtzr`; report confirmed scratch resources retired. Worker `root/repair-1`, thread `5bc8f7a0-0937-4f01-9225-e57ffd044493`. Contributor/current request HEAD `b8a83165acb0636d6c6f45a1e66ef5b917e9312b`; worker repair `b51766417ccafd8abc8aa30b0ffec1229e6bef63`; gated/pushed HEAD `00fcced7985df0168100c097b144857957c129be`; external merge `48fbcf04b2834646edb63ff320b02a9bea0216c8`.

Report showed coalesced request `review:["R1","R2"]`, threads T1/T2, prompt bodies/path/line/links and explicit untrusted-input boundary. Both reply markers named the pushed HEAD; both replies named the worker repair commit. Totals: two posts, one repair worker, five gate runs, zero host merge calls. Final target `github:seeded/lifecycle:main`, stage `done`.

Observed expected interruption: `PR observation/publication failed … seeded post-before-save cut`. The subsequent report contained both saved reply receipts and a retired worker, not a duplicate launch. Observed second-review exception explicitly required owner resolution, linked PR/review/T3 and included prior repair HEAD and T1/T2 receipts. External merge still reached completion.

## Expectations, frictions and checks

- Expectations 1–5: met in the supplied seeded sequence. Replay any of them with the entry point above; accept exit 0 and the reported counts/identities described here.
- Frictions: none preventing use. Output is verbose because the exception embeds its full request and receipts; the meaningful final summary remains identifiable. No unresolved product defect observed.
- Additional expectation: disposable setup cleans up itself — met by the final cleanup report. No servers/browser/deployments started outside that invocation.
- Evidence limit: this independent encounter executes the implementer's supplied probe and reads its output; it does not independently inspect the probe's internal assertions. Intermediate silent checks (lone comment, quiet approval, same-ID replay and during-repair arrival) are evidenced by its successful completion, not an independently captured per-step trace. Reviewer should assess those checks against the implementation. Live GitHub is deliberately outside this seeded encounter, owned by the parent's later live rehearsal.
- No separate unit suite/typecheck run by this driver; repository checks belong to implementation/review. No screenshots: CLI/library journey only.
