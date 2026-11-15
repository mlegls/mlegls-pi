---
stage: "done"
assignee: "agent"
priority: 3
author: "session:01a1e136-d362-7036-8a94-c7a82036023e"
---
During independent driving of [[projects/mlegls-pi/issues/foreign-commit-hold-cannot-be-cleared-when-handoff-omits-checkout]], the setup recipe documents reconcile_resolve with a checkout argument. The running session tool discovered with searchTools("reconcile_resolve") advertises action/adopt/issue/message/node/note/summary/target, with no checkout. No live resolution was attempted because it would act on the active supervisor run rather than a disposable run. The report library and historical completion replay run successfully from the worker checkout. This may be a runtime reload boundary; it is not evidence that the checked-out implementation omits the field. Provide a disposable CLI/library recipe for retry recovery, or a worker-owned refreshed runtime. Evidence: [independent packet](../attachments/foreign-commit-hold-cannot-be-cleared-when-handoff-omits-checkout/index.md).

## Result

Reload boundary, not a defect: the inherited session runtime predated the change; extensions/supervision/index.ts declares checkout at the reviewed head. The review drove retry with checkout through the resolutions directory in a disposable in-process reconciler (see the packet's Review section).
