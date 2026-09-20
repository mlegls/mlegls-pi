---
name: revise-theory
description: "Use when difficult issues or design friction suggest the codebase theory needs revision."
disable-model-invocation: true
---

`difficult` issues are the specimen cabinet: places where a small requirement
became a large change. Read them beside the mapped theory, actual code
structure, and open hypotheses (`architecture`). Closed issues still count.

1. Look for a concept or law that would have made several specimens ordinary.
   Develop the candidate freely in discussion or scratch. Confirm the written
   hypothesis before adding it to shared docs (`grilling`), including what it
   displaces and the cost of adopting it.
2. Find what would distinguish it from the current theory or another candidate.
   `theory-to-code` prototypes and `variety` can make competing structures
   visible. Generated interfaces and dependency graphs show what the code
   actually says; `measure-reader-load` helps when comprehension is disputed.
   Confirm the experiment's scope and effort before a substantial run.
3. Decide with the user whether the evidence warrants adoption. Then rewrite
   theory, migrate glossary terms, reconcile ADRs, and close the hypothesis
   together. `to-spec` carries the accepted shape into implementation.

The architecture document waits until production realizes the decision. A
hypothesis can be useful without being adopted, and a theory revision need not
always involve multiple prototypes or a migration project.
