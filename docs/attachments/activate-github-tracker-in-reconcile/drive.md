# Independent first-use drive

## Predictions (before opening product)

Revision: eba81814da7d4d8f5b1edf65bef47953b29789af. Setup completed via mise run setup per supervisor. Nonvisual CLI/library journey; existing gh authentication as mlegls; only authorized remote target mlegls/reconcile-pr-transport-20261014-35767b2d. Entry: `bun docs/attachments/activate-github-tracker-in-reconcile/encounter.ts`. Prepared disposable seed was cleaned up; entry recreates its owned temporary clone/linked checkout and issues after checking target permissions/readiness. No inherited deployment reused.

1. I expect the public CLI and getTracker to agree on gh identities, fields, text and native comment metadata in the linked checkout. Body-only stdin updates should replace the body without losing metadata.
2. I expect canonical vault selection to override a sparse worker's physical copy, and malformed GitHub selection to refuse rather than silently use a vault.
3. I expect a zero-budget reconcile invocation to reserve its eligible root without launching paid workers, repeated reservation to keep ownership, and provisional creation to preserve its exact attempt receipt.
4. I expect move-out to leave the root open, human-ready and unassigned with its reason; explicit probe cleanup may close only owned disposable issues.
5. I expect unsupported ancillary commands to diagnose the GitHub backend. Full first-worker launch, collector/target landing and recovery are outside the supplied entry's documented claims, and remain unobservable here (dependent rehearse-github-tracked-reconcile owns full live acceptance).

## Encounter

Ran the supplied entry unchanged from this worktree. Exit 0 after 1m49s. Readiness confirmed exact private owner, issues enabled and push permission. Actual isolated target: `/tmp/activate-github-tracker-0rLmxO/main` and linked checkout `/tmp/activate-github-tracker-0rLmxO/linked`; remote repository and persona matched the authorized handoff.

### Outcomes and expectations

Predictions 1–5 met within the entry's stated scope:
- Public CLI identity/fields/text/comments comparison, scoped snapshot, body-only stdin and combined fields/file operations reported success for gh-90.
- Sparse canonical vault precedence, ignoring worker physical vault, and malformed-config refusal all reported success.
- Root gh-90 reserved as `reconcile:gh-90`; zero workers; replay retained the same claim. Provisional gh-91 used exact `reconcile:gh-90/activation-provisional` and public remove succeeded.
- Native move-out reported human-ready, OPEN and unassigned. Unsupported frontier explicitly listed supported GitHub commands.
- No claim of paid worker launch, supervised move-out resolution, collector integration, target closure, full recovery or rate-limit backoff is established by this encounter. The dependent rehearsal owns full tree acceptance; retained-test constraints are for review, not a driver test-suite run.

### Replayable checks

Run `bun docs/attachments/activate-github-tracker-in-reconcile/encounter.ts` from the tested revision with the same authorized gh persona. Accept exit 0 and all publicCli/selection booleans true; reservation must report zeroWorkers and replaySameClaim true, exact root-derived stable/attempt receipts, and nativeMoveOut human/open/unassigned. This is an executable setup encounter, not independently authored tests; I did not inspect its source or implementation.

After it exited, independently ran `gh issue view 90 --repo mlegls/reconcile-pr-transport-20261014-35767b2d --json number,state,assignees` and the same for 91. Both were CLOSED with empty assignees. `test ! -e /tmp/activate-github-tracker-0rLmxO` succeeded. No driver-started server, browser or deployment remains.

### Frictions

No new product friction observed. The supplied entry is a bounded controller rather than a hands-on full tree journey: its output proves the listed public wiring comparisons but does not expose first-worker launch or supervised move-out ordering. Those remain unobservable in this drive, not evidence of failure. Existing index's regression counts are implementer evidence, not independently rerun here. No unresolved tooling failure occurred.
