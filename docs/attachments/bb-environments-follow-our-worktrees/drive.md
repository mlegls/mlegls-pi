# Independent CLI encounter

Tested checkout revision: `bc255ede565d3d8f3ccd0967451aecd9b8d8bdbd`.
Target: local BB `host_w74xscm3fz`, operator's existing CLI authentication. Owned checkout/environment: `bb-environments-follow-our-worktrees-drive-3` / `env_thaag9ntmp`; public `bb environment show` confirmed exact path, host and ready status. Setup notification confirmed `mise run setup` finished. No credentials, new agents, servers or destructive mutations used.

## Predictions recorded before product use

1. Newly spawned worker metadata should match its branch's `ab-parent`.
2. Retirement should remove the worktree and environment without losing the archived thread; a stale attached-checkout deletion should succeed.
3. The sweep should have an exact durable deletion count and leave no ready missing-path rows.

The initial prediction log was temporarily written to index.md before discovering it was an existing implementation packet; that file was restored intact and this independent packet created instead.

## Surface and observations

The supplied entry point was `bun test lib/thread/runtime.test.ts lib/thread/lifecycle.test.ts lib/dispatch.test.ts`. This is not a test-only ticket, so I did not run tests or inspect implementation/fixtures. Public `bb guide environments` and the committed [implementation packet](index.md) provided usable read-only entry points instead. No checkout-local agent-free wm spawn/retire recipe was supplied. The observations below concern the live supervisor's lifecycle, whose runtime revision is unknown; they do not establish that this checkout's implementation executed.

### Spawn merge target — failed on the observed live spawn

`bb environment show env_thaag9ntmp --json` reported ready, correct branch/path, but `mergeBaseBranch: null`. `git config --get branch.bb-environments-follow-our-worktrees-drive-3.ab-parent` returned `tree/retire-the-ab-thread-registry`. Expectation **not met** for this newly spawned driver. This could be an inherited supervisor running older code; no implementation cause inferred.

The implementer's environment `env_8zg7gb5596` did report `mergeBaseBranch: tree/retire-the-ab-thread-registry`, consistent with its packet's explicit manual metadata update; that does not prove automatic spawn.

### Retirement — failed on observed live retirement; stale deletion probe held

`bb thread show thr_qvu88kjy8s --json` showed the implementer archived (`archivedAt: 1792389007983`) and not deleted. Its environment `env_8zg7gb5596` remained `ready` / lifecycle `active`, path pointing at the absent implementer checkout. BB's own pull-request response said `Workspace path no longer exists`. An independent path-existence inventory confirmed this was the only ready missing-path row. Expectation **not met** for the observed retirement; runtime revision remains unknown.

Replayed the implementation packet's stale-deletion evidence via `bb environment show env_essmuz7d8u --json` and `bb thread show thr_dmdgsqbv9e --json` / `bb thread show thr_ufgqffjnxw --json`. Environment was destroyed, path null, teardown removed, attempt 1. Both archived threads remained inspectable with `deletedAt: null`. Thus the probe's retained-thread outcome **held**. I did not repeat deletion against somebody else's environment.

### One-off sweep — held for recorded historical sweep

Read-only entry: `bun docs/attachments/bb-environments-follow-our-worktrees/sweep.ts` exited 0 with `host_w74xscm3fz`, 23 ready, 1 stale, `apply:false`, 0 requested, 0 failures. Independent public-CLI inventory plus local `os.path.exists` identified the stale row as the subsequently retired implementer's environment above.

Paginated `bb environment list --host host_w74xscm3fz --status destroyed --limit 500 --offset <n> --json`, filtering `updatedAt >= 1792388658182` (the documented probe's update timestamp), corroborated **1,101 destroyed environments**: mlegls-pi 137, concept 843, another project 1, arkhai-payments 66, webapp 54. These exactly match the implementation packet. This is post-hoc corroboration of its historical count, not independent observation of all deletion calls. The sweep's prior zero-stale snapshot is not a promise that later broken retirements cannot add rows.

## Frictions and expectations

- Test-runner-only setup did not reach the operator lifecycle. Existing owner updated immediately: [[projects/mlegls-pi/issues/mail-drive-handoff-names-only-a-test-runner]]. Workaround: committed packet plus public BB CLI. Expectation of an executable operator recipe **not met**.
- Expected metadata and retirement cleanup were not present on the live supervisor's actions. These remain ticket acceptance gaps, not separate unrelated issues.
- Expected deletion to preserve archived threads **met** in the retained probe state.
- Expected a precise historical sweep count **met**, 1,101; expected current zero stale **not met**, one later stale row.

## Replayable checks for reviewer

1. Start a worker using the checkout's changed operator lifecycle (provide an agent-free public recipe). Read its git `ab-parent`, inspect `bb environment show <id> --json`: accept only exact equality with `mergeBaseBranch`, without manually setting metadata.
2. Retire that same owned worker through that lifecycle. Confirm path absent, environment destroyed after asynchronous cleanup, and `bb thread show <id>` still returns an archived, undeleted thread. Re-run the read-only sweep: accept no new stale row from this retirement.
3. Reinspect `env_essmuz7d8u` and its two thread IDs above: accept destroyed/removed environment with both threads still readable and undeleted.
4. Reproduce the paginated destroyed-row count with the timestamp above: accept 1,101 across the five project counts, accounting separately for any subsequent cleanup. Re-run read-only sweep and name any new missing-path row, rather than silently deleting it.

No browser/native UI used; visual false, no screenshots. No processes or external resources left running. No product repairs. Acceptance remains incomplete until the changed checkout-local lifecycle is actually driven.
