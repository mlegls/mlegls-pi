# Constraint delivery: first-use drive

Candidate `4aa63428`. The supplied entry point is `bun docs/attachments/reconcile-constraints-reach-workers-of-every-role/rehearse.ts`. It uses a disposable Git and tracker repository with fake BB workers, acting as run owner `thr_solo`. Readiness is a worker receipt; no live BB credentials are needed.

## Predictions before first use

1. As run owner, send an implement-only merge instruction. Expect the implement worker to receive it and a drive worker on the same node to see no instruction to merge, including in its first prompt.
2. Send a contract constraint without a phase. Expect it to reach current workers on the node and carry forward in later workers' first prompts, including review.

## Encounter

Ran the supplied entry point from the candidate checkout. It exited 0 in 25 seconds after reaching review. Observations are from the disposable replay's worker receipts and prompt summaries, not live BB threads.

- **Implement-only instruction — met.** The owner sent “Merge the prepared branch before changing code” during implement. Delivery returned `recorded: true, told: true`, with an implement-scoped receipt. The implement retry prompt included it; the drive first prompt did not. The owner then sent a second implement-only instruction during drive. It returned `recorded: true, told: false`; neither scoped instruction appeared in the review prompt.
- **Default node-wide contract — met.** During drive the owner sent “Use only the disposable vault” without a phase. Delivery returned `recorded: true, told: true`, with a receipt labeled “applies throughout this node's work.” The review first prompt included it. The final recorded list contained both implement-scoped instructions and the node-wide restriction.

## Replay checks

1. Run the entry point and compare `implement retry prompt has instruction: true` with `drive prompt has implement instruction: false`. The second implement-only submission, made during drive, must return `told: false` while retaining `recorded: true`.
2. In the same run, require a current-worker receipt for the unscoped restriction and `review prompt` showing `all: true, implementOnly: false, whileDriving: false`.

No friction encountered on the supplied path. The replay exited; no dev server or live BB deployment was started.

## Review

Re-ran `bun test lib/reconcile/constraints.test.ts` and the disposable replay. Both passed; the review prompt contained only the node-wide constraint. No behavior or test assertions changed in review.

The BB tool schema is a companion change in `bb-plugins` (`e9911ef`, branch `supervision-constraint-phase`). Land backend `4ddeb0fe` before enabling that schema: the old backend ignores `phase`, so it would deliver a scoped instruction node-wide.
