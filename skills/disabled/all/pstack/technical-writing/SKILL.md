---
name: technical-writing
description: "Use when writing or reviewing docs, RFCs, READMEs, PR descriptions, or commit messages."
---

Write for the document's purpose (Diátaxis) and the reader's task. Google
developer style, ASD-STE100, and Kohl's Global English are useful references.
Plain language can carry a precise idea without explaining how important it is.

No:

> **The proto budget — a one-way ratchet.** `budget.mjs` counts every file importing protos and checks it against the committed number in `budget.json` — go over and CI fails loudly. The clever part: `--write` re-baselines the budget to whatever the current count is, which is why you only run it when the count drops — run it after _adding_ imports and you've silently ratcheted the wrong way. This is load-bearing for the migration: the codebase can't quietly backslide.

Yes:

> `budget.mjs` reads the committed budget from `budget.json` and counts the files that import protos. If the count exceeds the budget, CI fails. Run `budget.mjs --write` only to lower the budget.
