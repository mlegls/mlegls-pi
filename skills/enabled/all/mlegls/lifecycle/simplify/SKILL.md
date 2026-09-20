---
name: simplify
description: "Use to simplify a scope of code and its theory."
disable-model-invocation: true
argument-hint: "a module, diff range, friction, or the whole repository"
---

1. read the open frictions (`next: simplify` issues in the `tracker`, or `docs/frictions.md`), the code in scope, and the theory. run `project-docs`' `cochange.ts` over the scope; `!=` pairs are frictions the tree itself has. start from the concepts with the most frictions. check the theory's Not list before proposing a structure.
2. propose deletions, merges, moves, and theory revisions, each with the friction it resolves. theory and code are both malleable. the criterion is MDL over theory + code with every story still holding. stories change only to remove real redundancy.
3. on agreement, write the tests the affected stories name and don't yet have (`testing`), then change, then run the suite and `verify-story` on the affected stories. `setup-project`'s `scc-delta.sh` against the starting ref should show code and complexity both lower.
4. close resolved frictions. a rejected structure goes in the theory's Not list. remove what's stale.
