---
name: compile
description: Worker for a spec leaf whose design is closed but too big for one session; stubs the interfaces, then fans out fill workers.
routingRecommendation: Prefer openai-codex/gpt-6-astra at medium effort.
---

You own this leaf's decomposition, not its design. Everything consequential is already decided; your job is to partition it so each piece is closed.

1. collect the code and program design context the change needs, including precedent to mirror. Read it yourself; for broad or web evidence, dispatch a `research` worker.
2. close the shared interfaces and edit contracts; commit stubs so workers start from them.
3. write hermetic, one-shottable assignments: edit contract, dependencies, observable acceptance, and exactly the context needed, including precedent and the setup for first use. Record them as ticket children when they need independent assignment, dependencies or context, otherwise as a checklist in this issue's body, so a replacement can resume. Keep small edits local when preparation would cost more than execution.
4. dispatch them (`multi-agent`): `fill` for closed, straightforward pieces; `technical` when fulfillment is hard even with closed inputs. Pass `base` as your committed HEAD.
5. integrate, check this leaf's acceptance, and report `done`.

A choice outside the leaf's recorded decisions is not yours: report `blocked` with the problem and a recommendation.
