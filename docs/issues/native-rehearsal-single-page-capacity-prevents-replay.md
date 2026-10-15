---
stage: "done"
assignee: "agent"
author: "session:c4138b58-4e96-4ba8-9081-e289831fbbed"
---
During rehearse-github-tracked-reconcile independent drive at bc32a67d, the documented full journey command exits before any run: `bun docs/attachments/rehearse-github-tracked-reconcile/journey.ts run` reports setup not ready because ten new issues would exceed its one-100-issue-page budget. The authorized preserved scratch repository already contains 95 actual issues per the prepared guide. Its read-only inspect entry passes but cannot replay launch/restart/refinement or the supervisor-required mid-run rate-limit hold. No inherited issues were deleted and no alternate repo is authorized. Workaround: inspect.ts verifies prepared merged artifacts, not live transient behavior. Need reusable first-use setup that preserves inherited artifacts while permitting the required live run. Evidence: docs/attachments/rehearse-github-tracked-reconcile/drive.md. This is a controller setup restriction; this observation does not establish that production multi-page real runs fail.

Resolution owner (2026-10-15 parent exception ruling): [[projects/mlegls-pi/issues/rehearse-github-tracked-reconcile]] now explicitly owns repair and fresh replay on the same preserved repository. The controller must not assume one first:100 page; the parent one-operation bounded-alias/completeness contract remains binding. The kept-chain drive is being retried with that repair authorized. This observation remains unresolved until the repaired readiness and live run are evidenced; prepared inspection is not a workaround for transient acceptance.

## Result

Fixed: the single-page guard was the rehearsal controller own admission assertion, not a production reader limit. Removed in 4fb3ff5c (the reader keeps cursor paging inside one logical refresh; the controller now accounts requests per refresh instead of assuming one). The full native journey was replayed live on the same preserved repository at 3b36ec18 with 99-109 issues: 44 refreshes, all complete, 3 at one request and 41 at two (TrackerSnapshot plus TrackerIssues). Evidence: docs/attachments/rehearse-github-tracked-reconcile/index.md (Fresh native replay). The earlier note that a bounded-alias single query remained binding was superseded by the supervisor: cursor paging inside a refresh stays.

Evidence: [docs/attachments/rehearse-github-tracked-reconcile/index.md](docs/attachments/rehearse-github-tracked-reconcile/index.md)
