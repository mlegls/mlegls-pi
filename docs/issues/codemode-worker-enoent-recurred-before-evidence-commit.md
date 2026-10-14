---
stage: "idea"
assignee: "agent"
priority: 2
author: "session:01a139d1-d102-7323-bd23-086b70b493c0"
---
On 2026-10-14, Concept worker integrate-fenced-retained-stream-catalog-recovery-implement-41 (session 01a139b1-f85e-74ef-bc8d-5029d5bdb37f) reported codemode ENOENT for pi-codemode/dist/runtime/worker.js before its final evidence commit. Retrying the commit through tools could not execute; it could not file the friction itself. Implementation commits 2d87346e, d54dec6c and 8b8ff5e8 survive, with three staged evidence files (2,812 inserted lines) in its worktree. Report: board message mv7xfxdv-zj2yax on consolidate-the-tutor-tool-catalog/integrate-fenced-retained-stream-catalog-recovery-implement-41. The full failing absolute path was not captured.

This recurs after [[projects/concept/issues/pi-codemode-worker-missing-during-a-live-drive]], whose disposition says future recurrences belong here. Owner is upstream @earendil-works/pi-codemode (earendil-works/pi); mlegls-pi is the local tooling tracker, not the Application owner. No matching live recurrence issue was found here.

Fresh handler session 01a139d1-d102-7323-bd23-086b70b493c0 successfully ran codemode read/bash/grep and tracker operations. The pi-on-Bun wrapper points through mise's latest symlink, currently ./1.2.0, and that installed version's node_modules/@earendil-works/pi-codemode/dist/runtime/worker.js exists; so does the mlegls-pi dependency's worker.js. No installation repair or shared process stop was performed. Whether the failed worker held a stale path or installation replacement occurred is unknown; successful fresh-handler tools do not establish repair of the old worker.

Workaround authorized: retry the implementation phase with a fresh tool runtime, retain the original branch/worktree and staged evidence, smoke-check tools before continuing, and finish the evidence commit through normal hooks. If it recurs, capture the full failing path, installation target and runtime/version before another restart. Investigate live-runtime survival across installation replacement only as a hypothesis, not an established cause. Application acceptance is unchanged; no lost product data or failing product behavior is inferred from this tooling report.
