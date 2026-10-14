# Independent first-use drive

Tested revision: `cd2ee859613a8924e422ac7834c962352d381675`.

## Setup and predictions (before opening)

Persona: operator using the supplied shell/library acceptance entry point. Deployment: invocation-owned disposable `/tmp/rc-pr-staging-*` private repositories, with isolated tracker/registry/agents/XDG state. Authentication: none; seeded GitHub observations plus a real private Git remote. Seed: root, two children and an outside dependent. Worktree setup finished according to supplied setup handoff. Replay: `bun docs/attachments/stage-reconciled-root-for-pr-landing/staging.ts all`. No shared deployment is reused.

Predictions from the ticket and user-facing evidence guide:

1. Absent/saved-local mode keeps local behavior; committed configuration captures PR mode, resume keeps it, invalid/conflicting inputs refuse before launch.
2. Children remain pending after collector integration; root gates execute in staging-parented workers and root landing changes staging only, leaving owner HEAD/code and global issues untouched.
3. Retirement/reload preserves reviewed results, exact staging identity and receipts; opening resume does not replay the satisfied tree.
4. A MERGED observation alone is insufficient. Actual fetched base ancestry permits child-first close with original results, and replay makes no further logical closes.
5. Owner sync fast-forwards only clean base-branch owners; dirty, other-branch, divergent and unavailable owners remain untouched without preventing remote completion.
6. PR mode ignores local mainRed; incomplete live publication remains dormant. Seeded observations must not be presented as live GitHub evidence.

This is a nonvisual CLI/library journey; no screenshots apply. I will run the supplied entry point without reading source, fixture code, diffs or tests. Repository test suites belong to the implementer/reviewer, not this drive.

## Encounter and outcomes

The supplied entry point completed successfully in 10m17s. All five cases reached their actual shell workers and integration surface. Each launched nine implement/drive/review workers; children landed into root, then root landed into its invocation-owned PR staging path. Three gate receipts per case identify the child collector parents and root's staging parent. Root receipts carry a and b, their original reviewed summaries/evidence, matching prepared/landed HEADs, and cleanupDone. Opening status is `pr-review`, target `github:seeded/staging:main`, with no active chains. The supplied checks for configuration capture/refusal, pending issues, owner protection, identity recovery, stop/reload and refusal without ancestry all completed without failure. These checks are observations through the supplied runner, not independent source inspection.

| Case | Staging branch suffix | Actual merge/fetched base | ownerSync | Close order / replay |
| --- | --- | --- | --- | --- |
| clean | root-89261ee6121a | 63d5026f | updated | a, b, root / 0 |
| dirty | root-7cd5e381f68a | f4b8fe27 | left | a, b, root / 0 |
| other | root-f5a4f95ef1eb | 3e617284 | left | a, b, root / 0 |
| divergent | root-34d404e173b7 | 770f35fa | left | a, b, root / 0 |
| missing | root-408b6c777484 | 8c54828f | left | a, b, root / 0 |

For clean, the root review thread was `4febe056-4147-4d93-8ce4-b8e3ab09c036`, staging prepared/landed HEAD `4bb18c94ffd506926a32955d5d9b2475e1eb9956`, parent `reconcile/pr/root-89261ee6121a`. The owner HEAD captured before landing was `2a75457e`; the runner reported updated owner synchronization after fetched merge proof. Dirty and other owners retained their captured HEAD; divergent retained its own commit `13f9e450`. Missing owner still completed remote target closure. Hook counts were 20 each, except divergent (21).

Expectations 1–6: **met within the supplied seeded acceptance surface**. No failed stories or unresolved product friction were encountered. Progress pauses between worker launches made the ten-minute run feel slow, but progress continued and no timeout/recovery was needed. I did not independently inspect intermediate files while the invocation was running. Live GitHub publication, polling and repair are not exercised; their ownership remains the later lifecycle/rehearsal tickets in the assignment.

## Replayable checks

Run the same entry command at the tested revision (or select clean/dirty/other/divergent/missing). Accept only successful completion plus receipts showing:

- children integrate into root before root integrates into a PR staging path; root gate's recorded parent equals that staging branch, never owner;
- staging ledger carries a, b and root with preserved reviewed results, status opening with no active chains, and no pre-merge global completion;
- saved mode/config/recovery/refusal checks complete before the merge encounter;
- mergeCommit equals fetchedBase, target is `github:seeded/staging:main`, closeOrder is a/b/root, and replayCloses is zero;
- ownerSync is updated only for clean and left for each protected/unavailable owner.

## Cleanup and evidence limits

All five exact invocation directories were checked after completion and no longer existed. No browser, server, tunnel or shared service was opened. No product code or tests changed. Earlier `receipts.json` belongs to the implementer's revision; this Markdown summarizes this independent run rather than relabeling those older receipts. GitHub observations are **seeded**, actual merge/fetch is against a private local bare remote, not live GitHub. Visual: false; shots: [].

## Review (appended)

Reviewed diff e03a1f6e..HEAD against the ticket. `bunx tsc --noEmit`, `bun test lib/reconcile` (13 pass) and the tracker script tests (24 pass) pass on the reviewed head. One repair: `stop` now falls back to the owner checkout when a recorded PR staging path is missing (e.g. stop during `preparing`) instead of failing on a nonexistent cwd; `stop.test.ts` still passes. No story outcome changed; the driver's packet was not re-run because the repair touches only that fallback.
