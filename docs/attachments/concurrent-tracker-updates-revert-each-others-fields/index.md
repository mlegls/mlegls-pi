# Drive a revision-guarded tracker edit

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

The second update should exit nonzero. The assignment should still be `user:mlegls`, the priority `2`, and the path history should have no commit for the refused update. Set `rev` to the new revision, then reapply only the intended priority edit.

```bash
(cd "$scratch/triage" && bun "$cli" update handoff --if-revision "$rev" --fields '{"priority":3}')
(cd "$scratch/main" && bun "$cli" text handoff --with-revision)
rm -rf "$scratch"
```
