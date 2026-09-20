---
name: compile
description: "Use to execute a spec whose inputs are closed: no unit will need to discover context."
argument-hint: "a spec from plan, or a shaped change"
---

1. spawn `autoread` workers (`wm.spawn`, `wait:true`) to find _all_ the code and program design context needed for the change, including precedent to mirror. don't do this yourself, to protect your context window.
2. write stubs as necessary for total interface coordination without communication.
3. break the work needed to fill the stub into hermetic, one-shottable, parallel chunks. via a workflow script (see `workflow.ts`), give each `fill` worker the stub and exactly the code/design context it needs to fill it (including relevant precedent). the worker should not need to read beyond its given context.
4. if a worker reveals a problem with the stubs or work compilation (`needs-input`, or a `decision` on its topic), `send` the affected workers a minimal steer, or restart only any workers whose current context would be too unrelated, and more toxic than helpful to the corrected replacement of their responsibility.
5. `orchestrate` `verify-story` over touched stories, as their units complete.
6. record returned frictions (`tracker`). commit. report `setup-project`'s `scc-delta.sh` against the starting ref.

workers and the board: `multi-agent`.
