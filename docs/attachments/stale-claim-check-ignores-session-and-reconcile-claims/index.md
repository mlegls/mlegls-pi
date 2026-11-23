# First use: stale tracker claims

## Predictions before first use

- Reconciler claims: `check` and the listings will label a claim stale when its root's run is finished or its PID is gone. A running root with a live PID will keep its claim, including a claim with a `/handle` suffix.
- Session claims: both surfaces will label an orphaned session claim stale if BB can be checked. A worktree, run, or live BB thread holding the claim will keep it from being marked stale. When BB cannot be checked, an otherwise unmatched session claim may remain unjudged.

## Encounter

Tested `7b4d04fe`. Ran `bun docs/attachments/stale-claim-check-ignores-session-and-reconcile-claims/first-use.ts` from the checkout. The entry point prepared a disposable Git vault and linked worktree, seeded a local BB store, ran the tracker CLI and exited 0. No live BB daemon, credentials or shared deployment were needed.

| Action | Observed | Expectation |
| --- | --- | --- |
| `issues tree` with reconciler claims | `run-ended` (`reconcile:ended/refine-1`) and `run-gone` (`reconcile:gone`) had `stale-claim:`; `run-active` had `claimed:`. | Met for finished, missing-PID and active roots. A `/handle` was exercised on the finished root. |
| `issues tree` with session claims and the seeded BB store | `session-stranded` had `stale-claim:`; `session-by-worktree`, `session-by-run` and `session-by-bb` had `claimed:`. | Met for each ownership source and the unmatched session. BB ownership was seeded rather than exercised against a real open thread. |
| `issues check` with the same state | Exit 1 with exactly three stale-claim diagnostics: `session-stranded`, `run-gone` and `run-ended`. Each said `verify ownership before clearing`. | Met; the live claims didn't produce diagnostics. |
| `issues frontier session-stranded` | Exit 0 with no rows. | Met the expectation formed from `check`'s wording: diagnosis leaves the reservation in place. |
| `issues tree session-stranded` without BB store access | Exit 0, retained `claimed:session:stranded`, no stale label. | Met the permitted offline behavior on the listing. Offline `check` was not part of this entry point. |

## Replay checks

Run the entry point above. The stale set in `tree` and `check` should be identical: the finished root's handle, the dead-PID root, and the unmatched session. The active root and all three independent session owners should remain claimed. Look for an empty frontier result for the unmatched session and a plain `claimed:` label when the BB store is unavailable.

No tooling friction encountered.


## Review

Reviewed `6e253b30..c8abc5e5` (`c6480501` is this ticket's code; the rest are merged siblings). Reran the entry point on the review head: same output as the encounter above, exit 0. The tracker, session-meta and BB thread tests pass (52 tests).

On this repository's real tracker, `check` reports one stale claim: `pi-settlement-identity-fails-after-done` held by `session:01a1595d-3077-73bf-a6ff-1379103911af`. No BB or Pi session transcript has that session id in its header; it appears only quoted in the supervisor's transcript. So the verdict looks right.

Cost: the BB lookup runs only when a session claim has no worktree, run or live Pi owner. It adds about 1.5 s to `check` or `tree` (2.6 s here, against 1.0 s with `BB_DATA_DIR` pointing nowhere). Almost all of that is `bbDataDir()` spawning `bb status --json`. Given the data dir, the query and transcript-header reads take 19 ms for 153 holders.

No repairs.
