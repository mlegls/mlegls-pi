# Worker commit hooks at integration

## Driver predictions (before replay)

- Integrating the branch whose bad commit was made with `--no-verify` will refuse to merge, show the hook's complaint, and send it back to the worker. The parent will stay put until the worker fixes the offending commit, then advance on retry.
- Running with `--hooks-path` will give the same result. A clean branch will merge on the first attempt without a repair message.
- The tracker directory will be absent in the sparse worker checkout. I expect this to establish filesystem exclusion only; provider read access may be broader.

## Implementer setup

From the project checkout, run `bun docs/attachments/check-worker-rules-at-integration/integrate.ts`. Add `--hooks-path` to run the same journey with a worker-local `core.hooksPath` override instead of `--no-verify`. The script creates a throwaway local Git repository with a collector, a sparse worker checkout and a stand-in BB inbox. It deletes them when it exits; no service or credentials are needed.

## Independent replay

Tested `52537436` from the drive worktree. Bun and the committed entry point were available; both commands completed with exit 0. The integration caller used a disposable local Git repository and a stand-in worker inbox (no signed-in provider or service).

| Action | Expected and observed in both runs |
| --- | --- |
| Integrate the bypassed commit with a later commit already fixing the tree | Pre-commit refused the offending commit (exit 1), with `pre-commit: remove REJECT from the staged code.txt`. The parent ref stayed unchanged and the worker stayed on `implementer`. The stand-in worker inbox printed the same hook complaint and the instruction to amend or rewrite the commit and retry. |
| Retry after rewriting the offending commit | Landed: `good final tree`. |
| Integrate a clean follow-on | Landed: `clean follow-on` on first attempt. No second refusal or repair message appeared. |
| Check sparse worker state | Both runs printed `Tracker materialized in worker: false` and `Tracker paths still in Git: 1`. The drive worktree also reported `!/docs/issues/` in its sparse patterns. A provider with access to Git objects can still read tracker contents; this is working-tree exclusion. |

No setup or interaction friction during replay. The commands exercise the integration entry point supplied for this ticket; they do not independently demonstrate reconciler landing, delivery through a live BB inbox, or provider-specific access restrictions.

To replay, run the two commands above. Compare the refusal with the worker follow-up, check that the parent stays unchanged through refusal, and check both successful landing messages. For tracker exclusion, check materialization and Git visibility separately.

## Review replay

`bun docs/attachments/check-worker-rules-at-integration/integrate.ts --reconciler` drives the reconciler's `landReviewed` entry point. The bypassed commit returned the pre-commit diagnostic in the landing failure; the collector stayed put and the worker was back on `implementer`. The direct inbox stayed empty, leaving notification to the reconciler's repair loop. Rewriting the history landed `good final tree`; the next clean landing produced `clean follow-on`. Both direct integration replays also held. The repair loop and a live provider were not started.

Each three-attempt replay took about one second with a shell hook that checks one file. A real installation pays the cost of its installed hooks on every incoming commit, even if the worker already ran them. Hooks see a detached historical checkout with the commit staged against its first parent, and dependencies from the prepared worker checkout. The replay checks the committed result; it cannot reconstruct the original branch-dependent hook environment or the inputs to a non-idempotent message rewrite.

`newThread` in `lib/thread/runtime.ts` calls `excludeTracker` before setup or provider launch for every worker. Providers that can run Git can still read the tracked objects.
