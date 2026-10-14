# Independent first-use drive 2

Tested revision: `85652dad375505404bcc9f1688a23aa2f3143b37`.
Nonvisual CLI encounter; no screenshots.

## Predictions recorded before first use

- Text entry: expect exactly three thread rows, with multiline blocked and report reasons contained within their respective rows; long reasons end in an ellipsis. No unindented continuation should appear between threads.
- JSON entry: expect three records retaining complete multiline reasons, including text omitted in the short display.

## Setup and readiness

Local CLI in `/Users/mlegls/dev/mlegls-pi__worktrees/thread-list-blocked-reason-spills-rows-drive-2`, the worker-owned checkout; no authentication. Supplied setup log confirms `mise run setup` completed both dependency installations. Entry presence confirmed before invocation. Implementer-provided entry creates isolated temporary three-thread state and cleans it automatically. This is seeded formatting state, not a live archive failure. No server or browser was started.

## Actions and observations

1. Ran `bun docs/attachments/thread-list-blocked-reason-spills-rows/first-use.ts`. Exit 0. Exactly three physical lines: parent, indented child, next. Child line contained both `report=blocked:Archive conflict unresolved blocked: needs a decision conflict details …` and `blocked=archive:Archive conflict unresolved blocked: needs a decision conflict details …` (excerpt; actual truncation ends `con…`). Both fields ended in the Unicode ellipsis. Newline boundaries became spaces. No continuation line separated child and next. Prediction met.
2. Ran `bun docs/attachments/thread-list-blocked-reason-spills-rows/first-use.ts --json`. Exit 0. Three JSON records. Child report body and blocked reason each retained `Archive conflict unresolved\nblocked: needs a decision\n`, the repeated conflict-details tail, and trailing space. No ellipsis replaced the tail. Prediction met.

## Replayable checks

- Invoke the text entry; accept exactly three newline-delimited rows, with report and blocked text only on the child row and both long summaries ending in `…`.
- Invoke the JSON entry; accept three records with the child's reason and report body containing two literal newline characters and the complete repeated tail, unlike the shortened text display.

## Outcomes and limits

Single-line text summaries: held. Long-summary truncation: held. Full multiline JSON: held. No friction encountered. The required row-formatter regression test is the reviewer's responsibility; this driver did not read source, fixtures or tests or run repository checks. No externally owned resources remain.
