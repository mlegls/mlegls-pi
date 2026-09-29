---
stage: idea
assignee: agent
author: "session:01a0eb02-2b0d-72c2-ae72-afd97ec8f7dd"
---

Two concept review children finished on 2026-09-28 and stalled as `waiting: handoff block did not parse: Unexpected scalar at node end`, because each wrote a YAML line that opens with a quoted phrase and keeps going:

- `supervise-playgrounds-as-drawers`, line 27: `- "Empty state has no route forward" stays outside this ticket; …`
- `supervise-frame-the-author-page`, line 26: `…decision made in review: "patch:title" is the name, and the editor says so. …`

YAML reads a leading `"` as the start of a quoted scalar, so any text after the closing quote is an error. Writers naturally open a sentence by quoting the name of a finding, so this will keep happening. [[projects/mlegls-pi/issues/turn-end-sentinel-parser-rejects-preambles]] saw the frame-the-author-page variant on 2026-09-26. In `lib/jobs/supervise.ts` the loop calls `except` on `handoffError` and waits for the owner, so the finished work sits there until someone reads it. Both branches had completed commits.

Possible directions (not decided): `lib/report.ts` retries a failed parse after quoting whole-line list items and values; the loop asks the child itself to re-emit a valid block before it involves the owner; or the role prompts ask for block scalars (`|`) in prose fields.
