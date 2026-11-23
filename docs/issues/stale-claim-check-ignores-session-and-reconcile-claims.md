---
stage: "done"
assignee: "agent"
priority: 3
author: "session:01a20657-0e8d-726c-98b9-a4f79a5a23fc"
---
Found in the 2026-11-23 audit of the supervision/issue orchestration system (@thread:thr_3pkhxrd57p).

> `claimLive()` in [issues.ts](../../skills/enabled/all/mlegls/conventions/tracker/scripts/issues.ts#L570-L580) only checks legacy `run_*`/`next` claims (misses modern `session:`/`reconcile:` stale claims)

Done when `check` and the listings mark `reconcile:<root>[/<handle>]` claims stale when `<root>`'s run state in the git common dir's `reconcile/` is finished or its pid is gone, and `session:<id>` claims stale when no worktree, run or live bb thread holds them (the bb lookup may be skipped when bb isn't reachable, leaving the claim unjudged).

## Result

done: both stories still hold on `1096cd24`, and I made no repairs. That commit only adds my review notes to the driver's packet.

- **Replay:** I reran the driver's script. `tree` and `check` flag the same three stale claims, the live claims stay `claimed:`, the frontier for the stale session is empty, and with BB unreachable the unmatched session shows plain `claimed:`. The tracker, session-meta and BB thread tests pass (52).
- **Real tracker:** `check` flags one stale claim, on `pi-settlement-identity-fails-after-done` (`session:01a1595d-…`). No BB or Pi transcript starts with that session id; it only shows up quoted in the supervisor's transcript. The verdict looks right.
- **Code:** `c6480501` is the only commit here for this ticket; the rest of the diff is merged sibling work. The new checks don't delete anything: dead live-process receipts are no longer removed on the way. A `reconcile:` claim whose root has no saved run state is left unjudged, as before; the ticket doesn't cover that case.

```yaml
commit: 1096cd24
stories:
  - story: "Mark reconcile claims stale when their root run has finished or its PID is gone."
    outcome: held
  - story: "Mark session claims stale when no worktree, run, or live BB thread holds them."
    outcome: held
evidence:
  path: docs/attachments/stale-claim-check-ignores-session-and-reconcile-claims/index.md
  visual: false
  shots: []
tests: []
filed: []
caveats:
  - "caveat: the BB lookup adds ~1.5 s to check/tree, measured 2.6 s against 1.0 s with BB_DATA_DIR pointing nowhere. It runs only when a session claim has no worktree, run or live Pi owner. Almost all of it is bbDataDir() spawning `bb status --json`; with the data dir known, the query plus transcript-header reads take 19 ms for 153 holders. The real tracker's one stale claim triggers it on every check. Preferring the BB_CLI runtime path when it already has a bb.db would remove the cost, but that changes how shared code picks the BB server, so I left it."
  - "BB ownership was confirmed only against a seeded local store and the real store's read-only data, not by creating a live thread."
```

Evidence: [docs/attachments/stale-claim-check-ignores-session-and-reconcile-claims/index.md](../attachments/stale-claim-check-ignores-session-and-reconcile-claims/index.md)
