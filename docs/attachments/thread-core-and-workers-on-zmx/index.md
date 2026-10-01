# Thread core join

The fresh-tool round-trip and two-level archive/merge joins held. No production repair was needed.

Implementation first use, not independent acceptance; no rendered UI. Starting ref: 1b705b8. Production code is unchanged from that ref. Fresh tools ran on 96c1967; the fixture's backward-compatible supervisor readbacks were re-driven on 311f1ef. Pi 0.99.2 loaded this checkout through the isolated agent directory, not the canonical checkout's package.

Independent drive: [predictions, encounter, checks and limits](independent-drive.md). Fresh tools, CLI archive/merge and identity/current-session/report joins held; nested destination lineage held, while this fixture's readback does not expose dispatch base SHAs for independent measurement. [Clean retry](independent-join-readback.json), [CLI lifecycle](independent-cli.json), [worker joins](independent-worker-readback.json), [reconciler lineage](independent-reconcile-readback.json), [cleanup](independent-cleanup.json). Review measured the base-SHA premise with a retained unit test (see the review section of the independent drive).

## Reproduce

Use a dedicated worktree of this revision. The join action integrates an empty worker commit into that worktree's current branch; it must be a checkout you own.

~~~sh
mise run setup
bun install --frozen-lockfile --cwd extensions/obsidian-tracker
ROOT=$(mise exec -- bun docs/attachments/wm-workers-over-threads/fixture.ts prepare |
  bun -e 'console.log(JSON.parse(await Bun.stdin.text()).root)')
mise exec -- bun docs/attachments/wm-workers-over-threads/fixture.ts join "$ROOT"
mise exec -- bun docs/attachments/wm-workers-over-threads/fixture.ts worker "$ROOT"
mise exec -- bun docs/attachments/wm-workers-over-threads/fixture.ts reconcile "$ROOT"
mise exec -- bun docs/attachments/wm-workers-over-threads/fixture.ts cleanup "$ROOT"
~~~

The directly exercised story entry was `fixture.ts join /private/tmp/wm-thread-IlAE3J`. Preparation creates an owned local Git project/main/owner checkout, isolated board/thread/zmx state and an agent directory registering this checkout's absolute package path. The join alone drives pi in the package checkout; worker/reconcile use the disposable project's owner branch. Authentication uses the existing local pi persona through a temporary auth link or inherited provider environment, not an anonymous substitute. `PI_FIXTURE_MODEL` can select another authenticated model. Preparation prints selectors; each journey waits for its reports/readiness. Reconcile takes several minutes, including a real startup-grace wait.

For CLI lifecycle first use, prepare a separate disposable target:

~~~sh
mise exec -- bun docs/attachments/thread-archive-and-abandon/fixture.ts prepare done
~~~

Set ROOT to its printed owned path and PARENT to its printed parent id. In one shell, from the package checkout:

~~~sh
AB="$PWD/bin/ab"
unset PI_SESSION_ID PI_SESSION_FILE PI_WM_RUN PI_WM_HANDLE PI_WM_PARENT_SESSION
unset PI_BOARD_TOPIC PI_BOARD_NAME PI_BOARD_FOLLOW PI_CHECKPOINT AB_THREAD_ID
unset TMUX TMUX_PANE ZMX_SESSION
export XDG_STATE_HOME="$ROOT/state" PI_BOARD_DIR="$ROOT/board"
export ZMX_DIR="$ROOT/zmx" PI_CODING_AGENT_DIR="$ROOT/agent"
export MISE_TRUSTED_CONFIG_PATHS="$ROOT"
cd "$ROOT/repo"
"$AB" thread archive "$PARENT"
~~~

Use this checkout's bin/ab, not the global script. The committed fixture waits for six real canonical pi agents to complete fixture-ready, then commits opposing parent/child values in conflict.txt. Its child instructions resolve on conflict mail. To exercise blocked/retry, prepare blocked instead, use the same selectors with `"$AB" thread merge "$PARENT"`, run the fixture's `resolve ROOT child` from the package checkout, then retry merge. Run `fixture.ts cleanup ROOT` even after failure. These are the existing child setup tools; no new acceptance suite or launcher is required.

Actual prepared targets were /private/tmp/wm-thread-IlAE3J, /private/tmp/ab-lifecycle-nJudgl (done) and /private/tmp/ab-lifecycle-QNG5rd (blocked). All journeys completed; all three targets and auth links were removed. Regenerate them, never reuse these historical paths. Fresh pi startup loads the changed package; /reload in a pi loaded from another checkout does not change its source path.

## Observed joins

| Claim | Action and result | Evidence |
| --- | --- | --- |
| Fresh tools on the dispatcher's branch | Pi 88767d2e… called tools.dispatch, read fresh tagged report mupksb8i-3em3io, then tools.integrate. Worker 37172932… recorded ab-parent = thread-core-and-workers-on-zmx-implement-i. Its empty commit 02aa0a5 became that branch's HEAD. Its worktree/branch/.agent vanished; only the driving guest remained, then it too was retired. Pre/post zmx ls and CLI ls were empty. | [Actual calls/results, report identity and inventories](fresh-tools.json) |
| Recursive archive conflict | Archive parent 579979f6… retired early d6a6e2e6… first, retained child/parent while main stayed at seed, and mailed only child 41f99efb… at mail/3aac79db. Fresh done mupkuwga-k73z87 from that exact canonical session resumed child → parent retirement. Main contained resolved-child; child-cwd leftover pid 90069 was gone, unrelated main peer remained. | [Before/waiting/after, mail and CLI cleanup](archive.json) |
| Merge alias blocked/retry | Merge retired early, then child b16fa1e5… reported blocked (mupkx1ne-lop8m2). CLI exited 1 with the same persisted child marker; child/parent and terminals remained. Fixture resolution followed by merge exited 0, retired only child/parent and cleared the marker. Main became resolved-child. | [Blocked result, retained state and retry](merge.json) |
| CLI identity/transport across cutover | New pi 348936de… → fork 20422869… copied history and kept its source parent with PI_SESSION_FILE plus a deliberately stale PI_SESSION_ID. Fork session-meta's newest thread id matched its own live canonical id. Promote kept free saved session 01a0f7b2… as a guest. Literal dollars/semicolon/brackets stayed unexecuted in shell history until explicit CR; source archive retired its fork first, guest merge preserved main, shell abandon removed its branch. | [Ids, histories, both trees and commands](identity.json) |
| Worker/current-session/report joins | Worker d8fa4464… reported bootstrap and follow-up. Literal send left the report cursor unchanged until CR. Jump ignored a newer free session and followed registry current-session replacement 01a0f7af…. Ordinary canonical pi reported on thread/id when resumed by hand; the free pi had neither thread metadata nor an automatic thread report. Killing .agent or the observed pi pid produced exited; missing/unreadable observations fabricated no exit. Keep-close preserved pi-worker. | [Selected worker events](workers.json) |
| Nested reconciler destination | Real backend-threads campaign relaunched a killed first worker after daemon restart. Leaf ab-parent was tree/fixture-nested; nested joins targeted tree/fixture-root; root joins targeted owner, although joins started from collector SHAs. Collectors recorded the same branch lineage. Reviewer prompts preserve comparison bases b148582b… and 3dc4b843…, not merge targets. All ten campaign workers ended archived, collector/chain/exception maps emptied, owner received leaf.txt and main stayed at seed. Public keep-integrate/retire and unmerged-retire also held after the fixture readback repair. | [Lineage, bases, final state and supervisor report](reconcile.json) |

The recorded collector SHAs are comparison bases extracted from the real review prompts, not separately logged dispatch arguments. The launch seam in lib/reconcile/reconcile.ts passes base and the destination checkout independently; the observed ab-parent lineage confirms they were not conflated.

These are CLI/worker encounters. In-pi /thread commands and rendered sidebar behavior belong to their sibling tickets; this packet does not certify those surfaces.

## Checks and cleanup

[Existing regressions](checks.txt): 182 pass / 2 skip; typecheck clean after the existing nested Obsidian dependency preparation; opt-in wm.local.test.ts 1 pass. No permanent tests were added. Fixture change: +16 net lines, no new dependency or production code.

The join cleared the completed CLI ticket's two stale dependencies and reconciled its Result with the landed fork fix. Tracker structural check now has only the 20 historical missing-link diagnostics owned by [tracker-check-links-to-deleted-history](../../issues/tracker-check-links-to-deleted-history.md); no checker was weakened or historical source link dropped.

[Cleanup](cleanup.json) records empty active threads/terminals/live stores, absent owned roots/auth links and absent selected worker/leftover/daemon pids. Global zmx ls and this checkout's ab thread ls --json were also empty; no join worker branch/worktree remained. Unrelated active checkouts were preserved. No browser, GUI, server, tunnel or deployment was started.
