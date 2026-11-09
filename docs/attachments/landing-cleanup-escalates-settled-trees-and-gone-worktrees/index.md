# Landing cleanup encounter

## Predictions before first use

Persona: developer running the supplied acceptance runner. No authentication. The handoff supplies local Git/fake-BB fixtures with isolated temporary repositories; no service, browser, inherited target selector or persistent seed is required. Run from this drive worktree, rather than the implementer's checkout.

At revision `1c0a4a38ce8d26b9dad4f89306632143ceb75814`, the supplied entry file is present and the checkout is clean.

Expected stories:
1. A landed collector containing only untracked/ignored state finishes cleanup without an exception, preserving ignored state as retirement does.
2. A deregistered or absent worker worktree finishes cleanup without an exception.
3. A collector with an unmerged commit still escalates.
4. Tracked modifications still escalate.

Entry point: `bun test lib/reconcile/landing-cleanup.test.ts`. I expect a successful runner exit with named cases covering those claims. I will observe runner results without reading source, tests or fixtures. This encounter exercises the supplied fixture surface; it does not operate a live supervisor installation.

## Encounter

Ran the entry point from this checkout using Bun 1.4.4. It finished successfully in 4.14 seconds: 4 passed, 0 failed, 31 assertions. No server or browser was started.

| Claim | Action and observed result | Outcome |
| --- | --- | --- |
| Settled collector with hook state cleans up | Runner passed both “landing cleanup removes a settled collector with hook state” cases, paired with missing-directory and missing-registration workers. | held |
| Missing worker is already cleaned up | Both missing-directory and missing-registration cases passed. | held |
| Unmerged collector escalates | Runner emitted `Collector has unlanded commits: collector`, then `landing cleanup failed → owner`; the owner-answer case passed. | held |
| Existing retirement behavior | The retired-worker/final-reviewer case passed, reporting ignored-state discard in its case name. | held |

## Expectations and limits

Predictions 1–3 were met at the supplied runner surface. The expected successful exit and named coverage were met for the ticket's three explicit done-when claims. Prediction 4 was not established: no runner case name or diagnostic specifically identifies tracked modifications. The reviewer should verify that guard from its permitted implementation/test inspection; this packet makes no independent claim about it. Likewise, preservation/movement of ignored state is not independently visible in the runner output.

No usability friction encountered. There was no rendered journey. The observations are acceptance-runner results, with fake-BB fixtures, rather than a live supervisor encounter; fixture internals and assertions were deliberately not inspected.

## Replayable checks

From the tested revision, run `bun test lib/reconcile/landing-cleanup.test.ts`:

- Accept settled-hook-state cleanup when both missing-directory and missing-registration cases pass with a zero exit status.
- Accept the unmerged-commit guard when the runner emits the unlanded-commit error and owner exception, and the owner-answer case passes.
- Accept existing retirement compatibility when the retired-worker/final-reviewer case passes.
- For tracked modifications, additionally exercise a landed collector containing a tracked edit and require escalation while retaining that edit. This check was predicted but is not observable from the supplied runner's output.

## Review

Read the diff against the ticket. Repair: the unlanded-commit guard treated any `git cherry` output as unlanded, but `git cherry` also prints `-` lines for commits patch-equivalent to the target (landed by rebase); only `+` lines are unlanded now. Tracked-modification guard (`status --porcelain --untracked-files=no`) read and found sound; no test covers it, and none is proposed. Replayed `bun test lib/reconcile/landing-cleanup.test.ts`: 4 pass, 31 assertions. Stories hold on the final head.
