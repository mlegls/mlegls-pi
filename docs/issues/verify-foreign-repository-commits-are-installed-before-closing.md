---
stage: "ticket"
assignee: "agent"
priority: 2
author: "thread:thr_879y94y97m"
---
The [[projects/mlegls-pi/issues/waiting-worker-loses-managed-process-registry-and-provider]] ticket closed as done while its implementation (`876e860`, `04a1ca0`) sat only on a `~/dev/pi-processes` branch; pi loads that checkout's `local-integration`, so the fix never ran until the efficiency audit of 2026-11-12 (@thread:thr_879y94y97m) merged it (`ad8a5e3`). The reviewer had warned that landing the mlegls-pi branch wouldn't land it (@thread:thr_dfgkcug6jp#msg=394).

decisions:
- 2026-11-12: before closing a ticket whose implementation lives in another repository, verify the configured checkout contains its reviewed implementation commit (maintainer, approving the audit's proposal).

## tasks
1. In reconcile's completion step ([lib/reconcile/completion.ts](../../lib/reconcile/completion.ts)), when a handoff names commits in another repository, check they are ancestors of the checkout pi or the project actually loads (for pi packages, the `source` in `~/.pi/agent/settings.json`); otherwise raise an exception instead of closing.
2. A test beside [lib/reconcile/completion.test.ts](../../lib/reconcile/completion.test.ts).

Done when: a handoff whose foreign commits aren't in the loaded checkout raises an exception, and one whose commits are closes as before.
