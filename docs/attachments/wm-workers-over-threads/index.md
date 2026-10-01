# Worker threads first use

Workers and supervisors use the registry/zmx lifecycle. Board topics remain run/handle; receipts add threadId. Canonical pi identity is separate and /jump reads the current record. Integration follows ab-parent, not caller HEAD. Collectors are Git aggregation worktrees, not threads.

Implementation self-check, not independent acceptance. Runtime revisions: 7b62a82, c2fd28d, e88d724, afec296. Worker observations were re-driven after afec296; the tools/collector journeys were driven on e88d724. These are nonvisual library/tool/CLI journeys.

## Replay setup

From this checkout, prepare its existing dependencies first (the nested install is the documented root-typecheck workaround):

~~~sh
mise run setup
bun install --frozen-lockfile --cwd extensions/obsidian-tracker
~~~

Then use the normal local pi persona:

~~~sh
mise exec -- bun docs/attachments/wm-workers-over-threads/fixture.ts prepare
mise exec -- bun docs/attachments/wm-workers-over-threads/fixture.ts worker ROOT
mise exec -- bun docs/attachments/wm-workers-over-threads/fixture.ts supervisor ROOT
mise exec -- bun docs/attachments/wm-workers-over-threads/fixture.ts reconcile ROOT
mise exec -- bun docs/attachments/wm-workers-over-threads/fixture.ts inspect ROOT
mise exec -- bun docs/attachments/wm-workers-over-threads/fixture.ts cleanup ROOT
~~~

`prepare` prints ROOT, all selectors and a directly runnable worker entry command. Each action prints ids and readiness/results. ROOT/fixture.json holds selectors; ROOT/repo/.git/reconcile/fixture-root.json holds persisted campaign state; ROOT/lineage.json records ab-parent while branches still exist. Run each journey once per prepared root. Reconcile includes a real 125-second startup-grace wait and takes several minutes. On a failed action, use cleanup on that same owned root.

This is a disposable local Git project with main and a separate owner checkout/branch. No Cloud target or seed is used. PI_CODING_AGENT_DIR is isolated and registers this checkout's absolute package path; the existing persona's auth.json is linked locally, never copied into evidence. Provider environment credentials also remain usable. PI_FIXTURE_MODEL optionally overrides the normal model. The isolated roster bounds the nested fixture's implement/drive/review procedures; it does not replace pi or its models. The supervisor action starts a real canonical pi, which calls freshly loaded tools.dispatch/integrate/retire.

Observed targets were /private/tmp/wm-thread-vJaJEH (final worker replay) and /private/tmp/wm-thread-4rgvYs (tools/reconciler). Both prepared successfully, then were completely removed, including authentication links. Earlier trial roots were removed too. There are no resident targets or processes to inherit; the committed preparation command reproduces them.

## Encounters

- [worker.json](worker.json): thread 0889e106-87fb-431d-8cca-84f849abec3b reported bootstrap and follow-up on worker-fixture/pi-worker. A literal send left report id mupjpi6b-bw61lm unchanged for three seconds; sending a real CR produced mupjpo7e-16cjce. History returned 25 plain lines with the follow-up visible.
- /jump ignored a newer free session. After the registry's current session was changed, it returned the replacement file, not the old file. The immutable thread id stayed the same. This checks the registry seam, not the sibling's in-pi /new command.
- Killing .agent yielded exited; keep-close retained pi-worker. Killing observed canonical pid 77831 separately yielded exited; discard-close removed pid-worker's branch. Making ZMX_DIR point to a regular file, and separately corrupting a live-store JSON record, surfaced observation errors and fabricated no exit. Temporarily hiding a live record while its observed pid stayed alive likewise produced no exit; status surfaced the missing state rather than returning gone.
- Ordinary canonical thread f6865996-d877-4dcb-9365-442d0440be55, resumed by hand in print mode without worker/topic env, recorded its thread in Live/session-meta and published done by-hand-ok on thread/<id>. Free session 01a0f790-f8f5-73b1-9c80-1cc001be7441 recorded no thread and published no automatic thread report.
- [supervision.json](supervision.json): driving pi 472f1308-188f-40a5-afb4-43e7397f86dd used public tools. c31eb33d-5f7f-467f-a3ad-6f7ad29fe17f integrated and retired; 31a96941-c2b8-4591-9a8a-fa4b4fb8fbea integrated with keep, then retired; c9c8d1dd-5fe5-40ac-b1c5-355f9a24c6a2 retired unmerged and retained tool-unmerged. Only the driving pi remained active at readback; owner contained integrated.txt and kept.txt, not unmerged.txt.
- [reconcile.json](reconcile.json): budget 1, backend threads. Worker dd017a3f-946d-4d92-94de-ba3da304e47c and daemon 89665 were stopped. After startup grace, daemon 70937 resumed the persisted campaign and relaunched once. Every leaf worker's ab-parent was tree/fixture-nested; nested workers targeted tree/fixture-root; root workers targeted owner. Both collectors recorded the same parent lineage. All ten worker records ended archived, collectors/chains/exceptions empty, zmx inventory empty. Owner received the implementation/evidence/issue-closing commits; main stayed at fixture.
- A synthetic pre-cutover state passed to start refused before creating a lock or log. Existing running old daemons can still be confirmed; stopped old campaigns need their original implementation, not migration.
- A temporary children.turnEnd experiment with two reports and an after cursor at the newest initially replayed the older report. c2fd28d fixes that and cancels detached polling. The same experiment then waited until abort, with no later poll or SQLite error.

Cleanup returned activeThreads: [] and terminals: [] for every real fixture. No browser, server, tunnel or external deployment was started.

## Existing checks and setup friction

bun test: 177 passed, 2 skipped. PI_TEST_LOCAL_WM=1 bun test lib/wm.local.test.ts: 1 passed, no model/auth required. bun run typecheck and git diff --check passed. Existing reattachment, fast-report, wait/abort, dispatch/retire and provenance regressions were adapted, not supplemented with permanent acceptance tests.

Root typecheck initially hit the known [Obsidian setup boundary](../../issues/root-setup-still-omits-obsidian-typecheck-dependencies.md). Installing the nested package's locked dependencies made it pass. A temporary macOS socket-path failure in the adapted shell fixture was fixed by using a short /tmp root; the replay fixture does the same. An initial reconciler readback tried to read ab-parent after successful branch deletion; it now records lineage while branches are active, and the final replay completed successfully.

Tracker check still reports the 20 historical references owned by [tracker-check-links-to-deleted-history](../../issues/tracker-check-links-to-deleted-history.md), plus the CLI sibling's two resolved dependency links. This ticket's resolved blockers were removed. Its semantic lint refreshed successfully; advisory completed/parent findings quoted a completed prerequisite and the explicitly assigned consumer join, respectively. The ticket remains open for independent driving/review.

## Independent driving

[Encounter packet](drive.md) records predictions before first use, library/tool outcomes, ids, replayable checks and cleanup on `09a2bd0`. Worker, supervision and nested-recovery journeys held; the recipe-owned fixture was removed. [Lineage](drive-lineage.json) and [campaign state](drive-reconcile-state.json) preserve final observations. Review and the parent's final fresh-tool join remain.
