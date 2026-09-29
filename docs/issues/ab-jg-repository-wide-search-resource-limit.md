---
stage: idea
assignee: agent
author: session:01a0eaef-ac3e-7645-a3e1-500dfb66b962
---

While implementing [[projects/concept/issues/cancel-pending-applet-wakes-when-the-learner-stops-a-turn]], a repository-wide `ab jg` query in `mlegls/pi` took 564.8 seconds and ended incomplete: 892 files were considered, with `resource_limit`, `source_inspection_limit`, and provider HTTP 400 (`max concurrent requests: 32`). The result had many uncertain or omitted source roles and did not resolve the implementation path.

Workaround: `ab grep` for the exact symbols (`releaseAppletPosts`, `surfaces.cancel`, and `appletWakePending`) returned the relevant source and tests directly.

Possible improvement: bound repository-wide discovery earlier or return a useful partial result before provider saturation. The observed impact of this failure mode beyond this run is unknown.
