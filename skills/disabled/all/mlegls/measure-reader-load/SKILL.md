---
name: measure-reader-load
description: "Use when auditing codebase readability or comparing how easily maintainers can understand candidate designs."
---

Reader load is the cost of reaching a correct model of the code. Preregistration
keeps the implementation from writing its own exam.

Confirm the proposed questions and experiment scale before publishing the
preregistration or launching a substantial evaluation (`grilling`).

1. Choose the audit scope or candidate checkouts. Before implementation where
   possible, save realistic maintainer questions in the issue or spec, drawn
   from user behavior, theory, or the design discussion. For an existing-code
   audit, derive them from those artifacts rather than the code being measured.
   Record when preregistration was not possible.
2. Give fresh answerers coherent question sets and repository access, without
   the design discussion or answers. Use the same protocol across candidates.
   `variety` helps when independent samples would be informative.
3. Judge answers against the intended behavior and actual implementation.
   Record successes and failures. A wrong answer is a comprehension failure,
   not a cheap successful run.
4. For correct runs, report available cost observations: tokens, files read,
   tool calls. Compare medians and ranges alongside success counts; do not
   conceal failures by reporting only surviving runs.

Keep comparison results with the hypothesis, or an audit beside the relevant
architecture docs. Questions that cannot be stated in the theory's terms and
answers that expose missing concepts are useful `difficult` observations.
The measurements inform judgment; they do not replace it.
