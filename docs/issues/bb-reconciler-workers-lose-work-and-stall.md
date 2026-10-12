---
stage: ticket
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

## Done when

Each item is fixed, or written up as deliberately left to the pi-durable cutover with the reason. In particular:
- (1) a worker in `error` raises an owner exception within one tick;
- (2) a `waiting` report never replaces a live worker;
- (3) long waits keep the provider connection alive or are chunked by the runtime, not by prompt advice;
- (4) a worker's worktree is never removed while it has uncommitted changes. Commit them to the kept branch as WIP first.
- (7) reconcilers run a pinned copy of the tracker scripts.

No new tests without maintainer approval in conversation (this repo's `docs/testing.md` policy).
