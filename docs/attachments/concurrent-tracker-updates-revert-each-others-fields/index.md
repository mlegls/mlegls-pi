# Drive a revision-guarded tracker edit

## Predictions before first use

- The triage writer can read the seed and a revision to use as a lease.
- After main reassigns the issue, the stale triage write will fail without changing either field or adding a commit.
- After rereading, triage can edit priority alone. Main will see the new priority, the reassigned owner and the original body.

From the source checkout, seed a disposable Git vault with a linked worktree. The two directories address the same issue. Bun and Git are required; no accounts or service are needed.

```bash
cli="$PWD/skills/enabled/all/mlegls/conventions/tracker/scripts/issues.ts"
scratch=$(bash docs/attachments/concurrent-tracker-updates-revert-each-others-fields/setup.sh)
(cd "$scratch/triage" && bun "$cli" fields handoff --with-revision)
```

Keep that output as the triage writer's read. Set `rev` to its `revision`, then reassign the issue from the main checkout. The triage writer changes the priority using the old read, including the assignment it saw.

```bash
(cd "$scratch/main" && bun "$cli" update handoff --fields '{"assignee":"user:mlegls"}')
(cd "$scratch/triage" && bun "$cli" update handoff --if-revision "$rev" --fields '{"assignee":"agent","priority":3}')
(cd "$scratch/main" && bun "$cli" fields handoff --with-revision)
git -C "$scratch/main" log --oneline
```

The second update should exit nonzero. The assignment should still be `user:mlegls`, the priority `2`, and the path history should have no commit for the refused update. Reread from triage with `fields handoff --with-revision`, set `rev` to the returned revision, then reapply only the intended priority edit.

```bash
(cd "$scratch/triage" && bun "$cli" update handoff --if-revision "$rev" --fields '{"priority":3}')
(cd "$scratch/main" && bun "$cli" text handoff --with-revision)
rm -rf "$scratch"
```

## Independent CLI drive

Tested `b9c5d0c9` using the disposable two-worktree setup above. The entry command confirmed readiness; no services or credentials were needed.

| Prediction | Observed |
| --- | --- |
| Read the seed and revision from triage | Met: `assignee: agent`, `priority: 2`, revision `f3d60982…`. |
| Refuse a stale edit without changing fields or history | Met: after main reassigned the issue, the stale edit exited 1: `handoff: issue changed since the supplied revision; re-read it and reapply your changes`. Main still showed `user:mlegls`, priority `2`, revision `05826bba…`. Both log reads showed the same two commits: create and reassignment. |
| Reread and apply only the priority edit | Met: a fresh triage read supplied the revision for the retry. Main's `text --with-revision` showed `user:mlegls`, priority `3`, `Original contract.` and a new revision. Exactly one update commit appeared after the retry. |

Replay checks: compare main's fields and log immediately before and after the stale write; require exit 1 and unchanged state and history. Reread from triage, retry with the priority key alone, then require the three expected values in main's `text` output and one new commit. The ordered interleaving reproduces a stale read; simultaneous process execution was not exercised.

No unresolved friction. The refusal said how to recover. The disposable vault was removed.

## Review: simultaneous writers

Using the same seed, main and triage each started an `update --if-revision` process with the seed revision, without waiting for the other to finish. Triage's priority edit succeeded; main's reassignment exited 1 with the stale-revision diagnostic. Main showed priority `3`, owner `agent`, and exactly two commits (seed and update). The disposable vault was removed. The retained `issues.test.ts` checks passed (32/32).
