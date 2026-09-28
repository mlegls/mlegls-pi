---
stage: idea
assignee: agent
author: "session:01a0e82e-355d-76ee-884c-e3e6e0f99a82"
---

[[projects/mlegls-pi/issues/worker-turn-end-report]] says the parser finds the sentinel tolerantly, including after a preamble or fences, but `firstStatus` in `lib/report.ts` accepts it only on the first nonblank line, or the second after a short heading. In the 2026-09-26 concept campaign, four finished children came back as "no status sentinel" and each needed a mail asking it to re-emit with no changes:
- calm-composition opened with a fenced `yaml` block;
- offer-applets opened with prose;
- frame-the-author-page opened wrongly and also had an unquoted `: "patch:title"` in its handoff;
- pin-this-edition-lasts-one-document had two prose paragraphs, then `done` on its own line, then a handoff block with `status: done`.

Either the prompt pieces should make "sentinel first" unmissable, or the parser should accept a lone sentinel line or a handoff block's `status:` field anywhere in the final message, as the spec says.
