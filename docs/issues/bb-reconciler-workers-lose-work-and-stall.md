---
stage: done
assignee: agent
author: "session:f7563ec2-2244-430b-b1a5-dc2eca48dc62"
priority: 1
part-of: "[[projects/mlegls-pi/issues/move-agents-onto-pi-durable]]"
---

Reconciler workers moved onto bb (`b700dcc0`, `ee15b483`, 2026-10-12) misbehave in ways the zmx runtime didn't. All were seen in the concept supervisor's session on 2026-10-12. "yes, and you can start a session in mlegls-pi on it" (maintainer, 2026-10-12).

1. **A worker that errors without reporting is never noticed.** A bb thread that ends in `error` posts no turn-end, and the reconciler keeps the phase "running" indefinitely. `query-checkpoint-replay-review-g` errored at 11:23 and the chain sat until the supervisor redispatched at 13:11. `keep-a-copy-of-web-media`'s chain sat behind an exception for an hour while its drive had already finished.
2. **Ending a turn with `waiting` gets a drive replaced mid-setup.** Drives report `waiting` while a local deployment starts. Under bb the turn end stops the pi, and the reconciler launches a fresh drive that redoes setup: `prioritise-language-template-structures-by-inventory-level` drive-2, then 3, then 4 within ten minutes.
3. **Workers that block too long time out.** Told to stay in one turn, a drive blocked on a build for over five minutes and hit `openai-codex WebSocket idle timeout after 300000ms` twice.
4. **A replaced worker's uncommitted work is deleted with its worktree.** `keep-a-copy-of-web-media-drive-9` held an 817 KB recording of the single authorized live DeepSeek draw, a write-up and two screenshots, all uncommitted. Its worktree was removed when the worker was replaced, and the paid evidence is gone.
5. **Session-id mismatch.** `ab thread to-bb` keeps the zmx session id in the thread record, while bb runs pi under its own ids. `601e5d8c` patched the self-wake loop this caused (matching by worker topic and name). The "already running?" check and the registry still compare the stale id.
6. **One bb thread alternated refine and implement turns and reset its branch.** `thr_bmk9urzztd` committed eight refined tickets (`37bcdb4d..6b2c31f0`), then, in a later turn, reset to base and reported `respec` as an implementer. Check whether a redispatch reused the thread rather than spawning one.
7. **Tracker scripts run from the live mlegls-pi checkout.** A merge in progress there left conflict markers in `issues.ts` (08:49), and every reconciler's snapshot failed with `Unexpected <<` until the merge was committed.
8. **Worker commits escape the project's hooks.** Four concept commits skipped its pre-commit formatter: three drivers committed with `git -c core.hooksPath=/dev/null commit`, one ran before Husky was installed (fixed in concept `a26f2dc1`). Evidence: concept `docs/attachments/worker-commits-escape-the-pre-commit-formatter/index.md`. (Added by the supervisor.)
9. **A redispatch started from the base, not the superseded worker's commits.** `query-change-projections-implement-k` committed `09a761ef`; after its drive stalled the supervisor redispatched, and the new implementer (`thr_tc5fj36hdg`) came up at base `0f95bd33` and had to ask to fast-forward. (Added by the supervisor.)

## Done when

Each item is fixed, or written up as deliberately left to the pi-durable cutover with the reason. In particular:
- (1) a worker in `error` raises an owner exception within one tick;
- (2) a `waiting` report never replaces a live worker;
- (3) long waits keep the provider connection alive or are chunked by the runtime, not by prompt advice;
- (4) a worker's worktree is never removed while it has uncommitted changes. Commit them to the kept branch as WIP first.
- (7) reconcilers run a pinned copy of the tracker scripts.

No new tests without maintainer approval in conversation (this repo's `docs/testing.md` policy).

## Result

Commits `6629f2bb` (cleanup), `1923c39f` (reconciler), `03a12005` (guard). Running reconcilers pick them up only when restarted. The guard and `agents/_common.md` reach a worker when it starts, and `_common.md` only once `agents-apply` has run. No tests were added. The approved retry fixture now sets `PI_RECONCILE_ERROR_SETTLE_MS=0`, and `lib/reconcile`, `lib/thread` and `lib/dispatch.test.ts` all pass. (`docs/testing.md` doesn't exist in this repo. The no-new-tests rule was taken from this ticket.)

What the incidents showed, and what changed:

- **(4) Fixed.** Before `lifecycle-cleanup` removes a worktree, it commits everything uncommitted (ignored files aside, so `.wm/` is skipped) as a `WIP:` commit with `--no-verify`. It keeps the branch, even on an abandon that didn't ask to keep it. If the commit fails, cleanup throws and the worktree stays. The reconciler notes each WIP retirement and mails the owner the branch. drive-9's files were untracked in `docs/attachments/` (supervisor), so this would have kept them. Collectors are no longer removed with `--force`.
- **(1) Fixed, and it was also the cause of (4).** drive-9 never ended. Its model request hung from 11:24 to 11:44, then failed with the idle timeout and posted an `error` turn-end. pi retried by itself (`context_edit`, then new tool calls at 11:44:11). The reconciler took the turn-end as final, and its provider retry stopped drive-9 ("The operation was aborted", 11:45:26) and replaced it. Changes:
  - An `error` report is acted on only after `ERROR_SETTLE_MS` (90 s), and only once the worker's pi is no longer working by bb's status or its live record.
  - A provider-error or bb-error exception is withdrawn when the same worker reports again.
  - A bb thread in `error` raises an owner exception within the tick, with the error block from `bb thread log`. The new `ThreadSnapshot.bbStatus` carries that status. These errors are bb command failures (`thread.start`: "pi did not answer get_state in time"; `turn.submit` and `thread/start` JSON-RPC timeouts), so pi never runs to report them. An exception handler in `error` escalates.
- **(2) Fixed.** The board shows two sessions posting on each of drive-2/3/4's topics. In each case the worker was waiting on its setup (drive-2: `0705f6f2`), and a second pi (drive-2: `86d1298d`) posted `checkpoint`. That was bb's sessionless pi, which took the worker's identity before `a5f4f80e`. A checkpoint restarts the phase when `runsProcess` can't tell, and the real worker had just been woken by mail, so it was working, not idle. Now:
  - the reconciler takes reports only from the worker's current session in the registry, and logs any it ignores;
  - a checkpoint during a wait is held to "wait first" unless the waited process is definitely gone.

  bb's own idle release of a pi, about 30 minutes in, would still end a long wait's managed processes. That is left to the pi-durable cutover, where processes outlive the agent.
- **(7) Fixed.** `pinTracker()` unpacks `lib/` and the tracker skill from `git archive HEAD` of the mlegls-pi checkout, once per commit, into `$XDG_STATE_HOME/mlegls-pi/tracker-pin/<sha>/`. `node_modules` symlinks point back to the checkout. A run uses that copy for every snapshot and parse check. Uncommitted or mid-merge files in the live checkout can't reach it.
- **(3) Not caused by long waits; nothing chunked.** The idle timeouts came in host-wide bursts:
  - six workers across concept runs at 11:00:48–50;
  - two at 11:19:33;
  - three at 11:43:59–11:44:00.

  In drive-9 and drive-a no tool was running. The model request itself sat 15–20 minutes before a 300 s timer fired, which points to a stalled provider or a suspended host, not a blocked turn. pi already retries these. The harm came from the reconciler acting on the error, which (1) fixes. Keep-alives for provider connections belong in pi-ai, or in the pi-durable cutover if real long blocks show up.
- **(5) Already fixed; one leftover closed.** Since `d176c95e`/`ee15b483`, `session-meta`'s `canonicalThread` adopts bb's session id and file into the registry when bb starts the thread's pi. Every live bb worker checked had matching ids. `bb-wake` now also counts a live pi carrying the thread's id as running.
- **(6) No thread reuse.** `thr_bmk9urzztd` was one thread, `replay-recordings-by-default-in-live-story-scripts-implement-b`, created at 13:10. Its session holds one assignment prompt and one board message. The implementer decomposed its ticket on its own and committed eight children. The reconciler's repair ("Implementers don't decompose: drop the children…") then made it reset to base and report `respec`, as designed. The cost is that refinement then redid those children. Starting refine from the implementer's branch after a respec is a possible improvement, not filed here.
- **(8) Fixed for worker shells.** The `guard` extension refuses `-c core.hooksPath=…`, `git config core.hooksPath <path>`, `--no-verify`, `commit -n` (alone or among short flags) and `HUSKY=0`/`HUSKY_SKIP_HOOKS` in `bash` and `process` commands of sessions with `PI_WM_HANDLE`. It also covers nested codemode calls. `agents/_common.md` says the same. Agent, stance, skill and prompt text here contains no hook-bypass advice (grep for `no-verify`, `hooksPath`, `HUSKY`), so the drivers improvised.
- **(9) Fixed by telling, not by changing redispatch.** A redispatch restarts the node from its parent's head by design (`retry` keeps the chain's work as base). The superseded branch was kept but never mentioned. Now the redispatch note names the branch and head of any commits not in the new base. The `reconcile_resolve` description says which action keeps work. Here the supervisor redispatched because the chain had stalled unnoticed, which is (1); with (1) fixed, `retry` is the usual answer.

### After the ledger landed (supervisor, 2026-10-12 ~16:08Z)

- **Pre-ledger state from fresh roots: accepted when provably empty.** Supervisor sessions loaded before the landing ledger still write states with no `landed`/`results`/`landingOps`/`refinements`, and `assertThreadState` refused them. Now `load()` gives such a state an empty ledger, but only when nothing could be missing from one:
  - no `landed` line and no refine launch in its log, and the log is shorter than its 400-line cap;
  - no collectors and no recorded tests;
  - no chain past drive, and none holding a refinement.

  Anything else is still refused, with a manual rebuild as before. Checked against concept's states: `make-milestone-0-…` (its pre-ledger copy) and `author-and-publish-the-language-learning-template` are accepted. `consolidate-the-tutor-tool-catalog` (pre-ledger copy; it launched a refine) and `query-provenance-time-and-hub-data` (it has landings) are still refused, so query-provenance needs the manual ledger rebuild.
- **`locked()` race: fixed.** When `integrate.lock` exists with no `pid` file yet, the reconciler now waits. It removes the lock as stale only if the lock is more than 10 s old. Any `mkdir` error other than `EEXIST` is rethrown.
