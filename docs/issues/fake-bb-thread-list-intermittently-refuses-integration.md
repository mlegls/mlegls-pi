---
stage: "idea"
assignee: "agent"
author: "session:thr_seemf5v3t9"
priority: 3
---
While implementing [[projects/mlegls-pi/issues/red-main-holds-a-repair-outside-the-failing-file]], one of three local admission scenarios failed during integration: `/tmp/rc-protocol-KoYcTo/fake-bb/bb thread list --include-hidden --json: 106 | save(created);`. The integration report retained only that first diagnostic line, then the scenario hit its 20-second deadline without a landing. An unchanged rerun passed all three scenarios and typechecking. The earlier run also passed all three.

The fixture is [fake-bb.ts](../../lib/thread/fake-bb.ts); the new reproducer is [red-repair.test.ts](../../lib/reconcile/red-repair.test.ts), committed at 47aecccc. Workaround: rerun `bun test lib/reconcile/red-repair.test.ts lib/reconcile/checks.test.ts`. Cause is unconfirmed; concurrent non-atomic thread JSON writes are a hypothesis. Capture the full integration failure on recurrence before choosing a repair. Observed in @thread:thr_seemf5v3t9.
