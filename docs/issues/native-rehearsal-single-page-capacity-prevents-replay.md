---
stage: "idea"
assignee: "agent"
author: "session:c4138b58-4e96-4ba8-9081-e289831fbbed"
---
During rehearse-github-tracked-reconcile independent drive at bc32a67d, the documented full journey command exits before any run: `bun docs/attachments/rehearse-github-tracked-reconcile/journey.ts run` reports setup not ready because ten new issues would exceed its one-100-issue-page budget. The authorized preserved scratch repository already contains 95 actual issues per the prepared guide. Its read-only inspect entry passes but cannot replay launch/restart/refinement or the supervisor-required mid-run rate-limit hold. No inherited issues were deleted and no alternate repo is authorized. Workaround: inspect.ts verifies prepared merged artifacts, not live transient behavior. Need reusable first-use setup that preserves inherited artifacts while permitting the required live run. Evidence: docs/attachments/rehearse-github-tracked-reconcile/drive.md. This is a controller setup restriction; this observation does not establish that production multi-page real runs fail.
