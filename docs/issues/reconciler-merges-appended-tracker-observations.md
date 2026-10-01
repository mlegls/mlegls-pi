---
stage: idea
assignee: agent
author: "session:01a0f797-f820-7245-8162-31f20d419868"
---

In the [role time audit](../attachments/role-time-audit/README.md), 12 of 13 integration failures were tracker-file conflicts, mostly parallel siblings appending recurrence observations to the same idea issue (concept `docs/issues/local-stop-cannot-terminate-checkout-owned-node-process-after-daemon-loss.md`). Each conflict went back to the reviewer's session. fold-author-workbench went through 3 send-backs, then an exception, a handler and a retry, twice. About 40% of review wall time came after the review's own report.

Both sides appending to a tracker file is a mechanical conflict, so the reconciler should resolve it without a worker. Options:

- `merge=union` for `docs/issues/**` in `.gitattributes`: zero code, but union also merges frontmatter edits silently.
- The reconciler resolves conflicts limited to tracker files by union when both hunks are pure additions in the body, and sends back anything else.
- Observations as fragment files (one per recurrence, the towncrier/changesets pattern), so siblings never touch the same file.
