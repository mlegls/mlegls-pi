---
name: compile
description: "Use to execute a spec whose inputs are closed: no unit will need to discover context."
argument-hint: "a spec from plan, or a shaped change"
---

1. use `autoread.run` to collect the code and program design context needed for the change, including precedent to mirror.
2. close the shared interfaces and edit contracts; write stubs only where useful.
3. prepare hermetic, one-shottable assignments. Use `route.prepare(taskWithContext, { stance: "fill" })`, then `dispatch.dispatch`; give each worker its edit contract or interface and exactly the context it needs, including precedent. Closed units can share a wave with open workers; keep small edits here when preparation would cost more than execution.
4. if a worker reveals a problem with the stubs or work compilation (an Orca question or escalation), `send` the affected workers a minimal steer, or restart only any workers whose current context would be too unrelated, and more toxic than helpful to the corrected replacement of their responsibility.
5. `orchestrate` `verify-story` over touched stories, as their units complete.
6. record returned frictions (`tracker`). commit. report `setup-project`'s `scc-delta.sh` against the starting ref.

workers and messaging: `multi-agent`.
