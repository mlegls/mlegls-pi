---
stage: "done"
assignee: "agent:auto-routine"
author: "session:thr_2m3ifztnfm"
priority: 1
---
Two concurrent writers of one global tracker issue lose an update: the later write puts back a field the earlier one changed, and nothing refuses it.

Observed in concept on 2026-11-08, during the daily report's whole-tracker triage (@thread:thr_95czt6kbwa), which split the backlog between child threads:

- `share-outcomes-from-local-hosts`: 544c354be (07:16:13) set `assignee: "user:mlegls"` and added a blocker; fd7551503 (07:16:21) set `assignee: "agent"` again and changed nothing else.
- `public-release-pulls-share-one-rate-limit-bucket-through-the-proxy`: 406a233c6 (07:16:09) set `assignee: "user:mlegls"` and edited the body; bfc523ebb (07:16:19) set `assignee: "agent"` again and changed nothing else.

Both pairs are direct `tracker: update` commits on main, in the middle of one burst of tracker writes (07:14–07:18), not merges. A second write that changes only the field the first one changed, back to its earlier value, is what a read-modify-write from a read taken before the first write produces: the writer passes the fields it read (or a whole frontmatter) to `issues.ts update`, and only the field that changed in between shows up in the diff. The report then said "someone" set them back, and the maintainer saw two settled reassignments undone.

Which writer did it (a child, the parent replaying a child's edits, or integrate) isn't established; the run's thread logs don't show the tool calls. [reconciler-merges-appended-tracker-observations](reconciler-merges-appended-tracker-observations.md) covers conflicting appends at integrate, not this.

Possible remedy: `update` takes the base it read (blob hash or the file's last commit) and refuses when the issue has changed since, the way `git push --force-with-lease` does; or `--fields` writes only the keys given, and callers stop passing back what they merely read. Reported by Concept Engineering for the maintainer (2026-11-09, @thread:thr_2m3ifztnfm).

## Result

done. Two simultaneous writers used the same revision from linked worktrees. Exactly one update committed; the other exited 1 with the stale-revision diagnostic. All 32 retained tracker checks passed. No code repair was needed.

```yaml
commit: 3eaae974
stories:
  - story: Read the seed and revision from a linked worktree
    outcome: held
  - story: Refuse a stale update without changing the issue or adding a commit
    outcome: held
  - story: Reread and apply the intended edit while preserving the reassignment and body
    outcome: held
evidence:
  path: docs/attachments/concurrent-tracker-updates-revert-each-others-fields/index.md
  visual: false
  shots: []
tests:
  - skills/enabled/all/mlegls/conventions/tracker/scripts/issues.test.ts
filed: []
caveats:
  - The revision guard is opt-in. A caller replaying fields from an earlier read must pass that read's revision.
```

Evidence: [docs/attachments/concurrent-tracker-updates-revert-each-others-fields/index.md](../attachments/concurrent-tracker-updates-revert-each-others-fields/index.md)
