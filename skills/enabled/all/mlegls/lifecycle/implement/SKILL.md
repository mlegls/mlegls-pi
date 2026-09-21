---
name: implement
description: "Use to make a bounded, agreed change."
argument-hint: "a ticket or clear bounded change"
---

1. read the ticket, affected stories, and theory. if it doesn't seem well-shaped enough to proceed, suggest `plan`.
2. make the direct, obvious change. assume yagni and treat code as a cost. use the one line solution where it works. do not write tests (tests are written separately, because as the implementer you know too much about what you wrote to write tests with realistic user empathy).
3. run the full existing test suite to ensure no behavioral regressions.
4. `verify-story` on the stories the change touched. fix what fails.
5. record any frictions (Ousterhout symptoms) you encountered while making the change, as a `next: simplify` issue linking the concept hit (`tracker`), or a line in `docs/frictions.md` on a remote tracker. record surprising realization costs likewise: what drives the cost, an alternative if known, and why we accept it if deferred.
6. commit. report `setup-project`'s `scc-delta.sh` and `jev-lint` against the starting ref, as well as any frictions recorded.
