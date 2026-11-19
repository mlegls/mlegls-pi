# Review blocked only on a post-landing check

## Predictions (before setup)

- Replay each of the three cited reviews as the fake reviewer. Expect the reconciler to proceed through integration without an exception, and each check to appear as an outstanding post-landing obligation in the node issue and reconciler log.
- Submit a review with a post-landing check and a separate fix required before landing. Expect a review exception for the owner and no integration while it is unresolved.

## CLI encounter

Tested `4695fc26fad42be6b2212742a928869f7eab3662`. Ran `bun lib/reconcile/setup-fixture.ts new --review` for each disposable repo/vault under `/tmp/rc-setup-*`. Setup reported phase `review`, the fake `solo-review-2` reviewer, and no exceptions. No credentials, shared checkout, or live dispatch used. Stopped all targets with `stop ROOT`.

### Checks and outcomes

Replay the historical checks using the documented current handoff: `turn ROOT BODY` with first line `blocked` and a fenced YAML block containing `stories: [{story: <name>, outcome: unobservable}]`, `evidence: {path: docs/attachments/review.md, visual: false, shots: []}`, `tests: []`, and `postLanding` with the checks below. Run `status ROOT` after processing and `issue ROOT`. For all three, the log recorded every check and `landed solo in the owner's checkout`, exceptions were empty, and the issue was `stage: done` with every check under **Pending post-landing checks**.

| Story | Source message in `thr_ihbpyrp6s2` | `postLanding` entries |
|---|---|---|
| Migration staging dispatch | 39367 | Dispatch lint.yml staging-only on main with and without changed registered modules; expect rehearse-migrations before deploy-staging only when required. Confirm environment secrets and workflow_call concurrency on the first dispatch. |
| Mirror npm publication | 40257 | Verify that the mirror push publishes core 0.2.1 with provenance and a rerun skips all five versions. |
| Mirror recovery | 40507 | Verify public main descends from 0ad57c642 and the next mirror-changing landing fast-forwards it. Match the Publish open packages push run to the exact recovery tip. |

For the mixed check, use the npm publication handoff and add a second story, `Recovery preserves existing public history in the local rehearsal`, with `outcome: failed`; add prose saying to fix the history reset before landing. `status ROOT` stayed at `review` with `exception solo: review blocked → owner` and no landing or recorded post-landing check. This matched the prediction.

### Frictions and limits

- The historical reports did not already use the documented structured handoff. The verbatim migration report still went to the owner as `review needs-input`; the verbatim publication and recovery handoffs were rejected because their historical commits are foreign to the disposable repo. The successful replays translated the checks to the current format and used the disposable review evidence; they do not establish automatic interpretation of old free-text reports.
- I initially supplied the wrong evidence path, `docs/attachments/solo/index.md`. The three reports passed review triage but integration sent them back with `Missing or external evidence`. I located the committed `docs/attachments/review.md` path in the disposable review checkout and resubmitted; all three then landed. The ordinary evidence gate held.

## Review

Restricted automatic acceptance to blocking statuses. A `done` report with an unobservable story and `postLanding` previously bypassed the ordinary `done` contract. Replayed the trusted npm report from [the rehearsal](index.md) with its first line changed to `done`: the reviewer received the `unheld` repair. Replayed all four reports from that rehearsal unchanged. Migration, publication and recovery closed with zero exceptions and each of their two, one and three checks respectively present in the issue and log. The mixed report raised `review blocked`. All five disposable targets were stopped. The driver's initial evidence-path rejection was a caller error; the gate worked as intended.
