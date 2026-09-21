---
name: compile
description: "Use to prepare closed implementation assignments for execution."
argument-hint: "a spec from plan, or a shaped change"
---

1. use `autoread.run` to collect the code and program design context needed for the change, including precedent to mirror.
2. close the shared interfaces and edit contracts; write stubs only where useful. Return consequential choices outside the agreed scope to `plan`.
3. record hermetic, one-shottable assignments in the issues (`tracker`): edit contract, ownership, dependencies, observable acceptance, and exactly the context needed, including precedent. Reference durable code and docs; commit any stubs so workers can start from them. Keep small edits local when preparation would cost more than execution.
4. record `fill` for closed, straightforward assignments; technical difficulty still warrants `technical` even when inputs are closed. Leave deliberately open units explicit for `realize` to route separately.
5. return the prepared issues and starting ref to `realize` for admission, dispatch, integration, and `verify-story` over touched stories. Preparation is complete without launching workers.
