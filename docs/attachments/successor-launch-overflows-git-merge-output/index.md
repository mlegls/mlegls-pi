# Successor merge overflow verification

## Predictions before use

From the ticket and setup handoff, as the developer running the supplied regression entry point:
1. Successor refresh succeeds without a large merge summary; the runner reports a passing diffstat / merge-argument regression.
2. Large reconciler git output avoids the default 1 MiB limit; the runner reports enlarged-buffer coverage.
3. Worktree creation failure before ownership leaves no partial resources; cleanup regression evidence is observable.

## Setup and reproduction

Tested revision: `6289fc1f32de560e2ee78c26ce99315ee7b11866`.
Owned target: `/Users/mlegls/dev/mlegls-pi__worktrees/successor-launch-overflows-git-merge-output-drive-2`.
Deployment: local disposable git/shell fixtures. Persona: developer; auth: none. No external deployment or credentials. No seed operation required.
Supplied `mise run setup` log confirms both frozen-lockfile installs completed. Working tree initially clean.
Entry point: `bun test lib/reconcile/refresh.test.ts lib/thread/runtime.test.ts lib/thread/lifecycle.test.ts`.
No source, diffs, test bodies or fixtures inspected; regression runner is the supplied developer surface.

## Encounter and outcomes

Executed the entry point in the owned checkout. Exit 0 in 33.55 seconds: **13 pass, 0 fail, 77 assertions, 3 files**.

- **held, runner evidence:** `successor merge suppresses diffstat and reconciler git accepts output above 1 MiB` passed (759.89 ms). Predictions 1 and 2 met at the supplied regression surface. Exact merge flags and 64 MiB constant are not independently inspected.
- **held, runner evidence:** `an integrated handler ruling reaches a successor before setup and launch, keeping predecessor work` passed (6939.61 ms).
- **unobservable:** prediction 3 not established by the supplied entry point's visible output. Runtime ownership/idempotency passed, but no named pre-ownership worktree-creation failure case appeared. Reviewer must establish this required cleanup check under the existing ticket; generic green results are not proof of fault-path cleanup.
- Runtime: 3 passing cases covering ownership/setup, ambiguous handles, and collector parent recording. Lifecycle: 8 passing integration/conflict/archive cases.

## Frictions and replayable checks

No runner failure or tooling friction encountered. Evidence friction: the supplied entry point does not expose whether the particular cleanup fault path was exercised.

1. Replay the entry point at the tested revision. Accept exit 0 and the named suppression / above-1-MiB case passing.
2. Replay the entry point. Accept the integrated-handler-before-setup case passing.
3. For reviewer verification, provoke worktree creation that partially creates a checkout then throws before ownership is recorded. Accept absence of that checkout and its git worktree registration afterward, and absence of any orphan thread/resources. This remains unobserved here; the original ticket owns it.

## Cleanup and limits

Managed runner exited normally. No server, browser, external deployment or other retained resource started by this driver. Nonvisual packet; no screenshots. This encounter verifies the supplied runner rather than the original Common Concept deployment.

## Review (appended)

Read the diff of `6289fc1f`: `refresh.ts` adds `--no-stat`; `checks.ts` `git` sets `maxBuffer` 64 MiB; `refresh.test.ts` traces the merge arguments with `merge.stat=true` set and merges a 2 MiB file; `runtime.ts` sets `owned = true` before `worktree add`, pre-checks branch existence, and makes cleanup tolerate an unregistered path and an absent branch.

Prediction 3 (previously unobservable) established by fault injection (scratch test, not committed): a repository whose `.gitattributes` sets a required smudge filter that fails, so `git worktree add -b boom` creates the branch and then fails at checkout, driven through the real `newThread`.
- Base `a52c3e82` `runtime.ts`: error reports "Partial resources cleaned", but branch `boom` remained (leak; the message was false).
- Head: path absent, branch `boom` absent, `git worktree list` shows only main. Also a nonexistent `base` (git fails before creating anything) leaves nothing.
- Outcome: **held**. No review repairs were needed. Re-ran `bun test lib/reconcile/refresh.test.ts lib/thread/runtime.test.ts lib/thread/lifecycle.test.ts`: 13 pass, 0 fail.

Residual: the cleanup's registered-worktree check compares the raw `git worktree list` path with `location.cwd`; a symlinked project path (e.g. `/tmp` vs `/private/tmp`) would take the `rm` branch and leave a stale registration. `location.cwd` derives from `spawning.project`, which is already realpath-normalised elsewhere, so not observed.

