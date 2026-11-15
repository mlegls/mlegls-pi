/home/mlegls/dev/mlegls-pi__worktrees/foreign-commit-hold-cannot-be-cleared-when-handoff-omits-checkout-review-3/docs/attachments/foreign-commit-hold-cannot-be-cleared-when-handoff-omits-checkout/index.md (51 lines)
# Independent first use

Tested revision: 312b7362ca85b1a526ae4d5f313afd6cfb5bff8c.

## Predictions (written before opening the surface)

1. Historical bare foreign commit list returns an actionable report error; a checkout-qualified report is accepted. **Met.**
2. A saved historical handoff initially holds, then completes once a child identifies loaded bb-plugins, without stopping the reconciler. **Met through completion library.**
3. A foreign commit present in a repository but absent from loaded HEAD continues to hold; installation permits completion. **Met.**
4. An existing hold can receive an explicit checkout on retry and rerun ancestry verification. **Unobservable in this pass.**

## Setup and readiness

Local library/CLI in this worker checkout; no server, authentication, secrets or inherited deployment selector. Disposable repositories own all writes. Real mlegls-pi and bb-plugins are read-only. No source, tests or fixture contents were read. Used the committed [setup recipe](implementation-first-use.md), importing its named library functions as the provided surface. Invoking its report entry point succeeded and established readiness.

## Actions and observations

### Report admission — held

Called `parse` from `./lib/report.ts` with `done` and a YAML handoff, passing this checkout as its second argument. `commit: [3aeaaff5, 602606f]` returned:

> Foreign commits 602606f need commit: { checkout: /absolute/loaded/checkout, commits: […] }. Repost the handoff with their loaded checkout.

Repeating with `commit: { checkout: /home/mlegls/dev/bb-plugins, commits: [602606f] }` returned `handoffError: null`. This exercises admission, not an agent's subsequent response to a follow-up prompt.

### Historical saved result — held

Ran the Historical completion replay command in the setup recipe unchanged in behavior. Before recording a child checkout, completion raised `has no verifiable loaded checkout` with advice to name the loaded checkout or resolve with retry and checkout. Added the child's setup checkout `/home/mlegls/dev/bb-plugins` and repeated `closeAtTarget`: disposable attention issue stage became `done`. Neither `reconcile_stop` nor a live tracker write was involved.

### Uninstalled foreign commit — held

Created a private `/tmp/foreign-drive-*` Git repository, committed an empty loaded base, committed a second empty foreign change, recorded its SHA, and reset loaded HEAD to the base. Used the same completion recipe with that SHA as the root's bare commit and the disposable repository as its child's setup checkout.

Completion raised `is not installed in loaded checkout`, naming that repository and its loaded HEAD. Disposable issue stayed `ticket`. Fast-forwarded that repository to the foreign change and repeated the identical completion call: issue became `done`. Both disposable repositories were removed in `finally` blocks. No servers or processes remain.

### Explicit retry resolution — unobservable

Discovered the running `reconcile_resolve` tool schema: it has no `checkout` argument, although the setup recipe calls for that argument. The running tool is an inherited runtime rather than this checkout's deployment; using it on the active issue would alter the supervisor's run. The setup recipe describes its in-process recovery run but supplies no executable recovery command. Did not infer a public constructor or read implementation to reconstruct it.

Friction recorded outside the execution subtree: [[projects/mlegls-pi/issues/foreign-hold-drive-runtime-lacks-checkout-resolution-argument]]. This observation does not establish a defect in the checked-out tool implementation. The reviewer needs a disposable retry replay to finish this claim.

## Replayable checks

- Run the report command in the setup recipe with both handoff forms above. Accept an actionable shape error for bare foreign SHA and null error for qualified SHA.
- Run the historical completion command in the setup recipe. Accept the initial missing-checkout error followed by final stage `done` after the child checkout is added.
- Repeat that recipe with a disposable Git checkout containing a foreign change only in its object database, not reachable from HEAD. Accept `ticket` plus an uninstalled-commit error; fast-forward HEAD to that change and accept `done` on the next call.
- Pending: start a disposable held reconciler, submit `retry` with checkout through its supported resolution surface, observe it retain the ancestry hold until installation and close after installation without launching another worker or stopping the run.

## Limits

No rendered UI; no screenshots. Did not observe same-turn agent correction, constraint-only checkout discovery, or actual retry-queue handling. Historical fallback and ancestry sensitivity were directly observed through the supplied library entry point. Packet changes only; no repairs or tests.

## Review

Reviewed head 14d9aa16 (change 3ecce201 plus the driver's packet). Settled the explicit-retry story the driver could not observe.

### Explicit retry resolution — held

Drove the in-process reconciler (protocol fixture, budget 0, fake bb owner) with a scratch test, deleted afterwards. Saved root: landed at target, result `commit: [<sha>]` where the sha is a commit on a side branch of a disposable "loaded" repository whose HEAD lacks it, and an owner exception "foreign implementation not installed". Queued resolutions through the resolutions directory, as `reconcile_resolve` does:

1. `{action: retry, checkout: "relative/path"}`: dropped; exception stays pending; `foreignCheckouts` unset; owner told the checkout must be absolute.
2. `{action: retry, checkout: <loaded>}`: `foreignCheckouts.root` saved; completion re-held with "not installed in loaded checkout"; issue stayed `spec`.
3. Fast-forwarded loaded HEAD to the commit: next pass closed the issue, exception removed.

Run counter stayed 0 throughout: no worker launched, no `reconcile_stop`. The schema field `checkout` exists in `extensions/supervision/index.ts` at this head; the driver's friction was the inherited runtime predating it (closed in the tracker as a reload boundary).

### Checks run

`bun test lib/report.test.ts lib/reconcile/{completion,exceptions,constraints,retry,resume}.test.ts extensions`: pass on rerun. One earlier run failed `constraints.test.ts` ("a mid-implement constraint reaches drive and review first prompts"); it passed alone and in the rerun with the same files, so a load flake. No code repairs; no tests changed.
