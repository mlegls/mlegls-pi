---
stage: idea
author: session:01a0f53f-6e4e-772c-ba5c-877924f2fa48
---

Owner: `ab supervise status`. First use for [[projects/mlegls-pi/issues/supervise-status-shows-each-jobs-running-services]] showed `no supervision jobs here` from the drive worktree although the public daemon response included the parent ticket's running job under the canonical checkout. The output did not identify which checkout “here” meant.

Tried default status, ticket-specific status, and `--all`; all returned the same empty output. Workaround: read `supervise status --help` for the scoping rule and query `ab daemon status` separately to distinguish no jobs in this checkout from no jobs in the daemon. No shared jobs were changed. [Evidence](../attachments/supervise-status-shows-each-jobs-running-services/index.md).

Possible improvement, not an observed contract failure: include the owning checkout in empty status output so the scope is visible without consulting global daemon records.
